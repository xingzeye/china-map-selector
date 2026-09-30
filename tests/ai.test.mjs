import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { generateKeyPair, SignJWT } from 'jose'
import { createCredentialStore } from '../server/credential-store.mjs'
import { createChatGPTLogin, verifyIdentity } from '../server/chatgpt-oauth.mjs'
import { createBridge } from '../server/ai-server.mjs'
import { createModels, createProvider } from '@earendil-works/pi-ai'
import * as completionsApi from '@earendil-works/pi-ai/api/openai-completions'
import { toContext, validateEndpoint } from '../src/ai/catalog.js'

const temp = () => mkdtemp(path.join(os.tmpdir(), 'shanhai-ai-test-'))

test('凭据加密保存、并发刷新串行执行、重新启动后恢复、退出清除', async () => {
  const directory = await temp()
  const store = await createCredentialStore(directory)
  await store.modify('openai', async () => ({ type: 'oauth', access: 'secret-access', refresh: 'secret-refresh', count: 0 }))
  await Promise.all(Array.from({ length: 8 }, () => store.modify('openai', async current => ({ ...current, count: current.count + 1 }))))
  const raw = await readFile(path.join(directory, 'credentials.enc'), 'utf8')
  assert.ok(!raw.includes('secret-access') && !raw.includes('secret-refresh'))
  assert.equal((await (await createCredentialStore(directory)).read('openai')).count, 8)
  await store.delete('openai')
  assert.equal(await (await createCredentialStore(directory)).read('openai'), undefined)
})

test('JWT 校验拒绝错误签名、nonce、audience、过期与缺少 subject', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256')
  const sign = (claims = {}, audience = 'issued-client', expiry = '2m') => new SignJWT({ nonce: 'expected-nonce', ...claims }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://auth.openai.com').setAudience(audience).setSubject('account-123').setIssuedAt().setExpirationTime(expiry).sign(privateKey)
  const good = await sign()
  assert.equal((await verifyIdentity(good, 'issued-client', 'expected-nonce', publicKey)).sub, 'account-123')
  await assert.rejects(verifyIdentity(good, 'issued-client', 'bad-nonce', publicKey))
  await assert.rejects(verifyIdentity(good, 'other-client', 'expected-nonce', publicKey))
  await assert.rejects(verifyIdentity(await sign({}, 'issued-client', '-20s'), 'issued-client', 'expected-nonce', publicKey))
  const other = await generateKeyPair('RS256')
  await assert.rejects(verifyIdentity(good, 'issued-client', 'expected-nonce', other.publicKey))
  const noSubject = await new SignJWT({ nonce: 'expected-nonce' }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://auth.openai.com').setAudience('issued-client').setIssuedAt().setExpirationTime('2m').sign(privateKey)
  await assert.rejects(verifyIdentity(noSubject, 'issued-client', 'expected-nonce', publicKey))
})

test('OAuth 验证 state、PKCE、权限、一次性回调，并保留 issued client 重连', async () => {
  const store = await createCredentialStore(await temp())
  let tokenRequest
  const coordinator = createChatGPTLogin({
    store, deviceId: '6a87c831-a2f7-4b03-b22d-04b1146f37e0',
    fetcher: async (url, options) => {
      tokenRequest = options.body
      return Response.json({ id_token: 'test-id', access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600, scope: 'openid chatgpt.tokens.use.direct offline_access' })
    },
    verify: async () => ({ sub: 'account-123', email: 'traveler@example.com' }),
  })
  try {
    const login = await coordinator.start()
    const auth = new URL(login.url)
    assert.equal(auth.searchParams.get('client_id'), 'dynamic_agent_client')
    assert.equal(auth.searchParams.get('code_challenge_method'), 'S256')
    assert.equal(auth.searchParams.get('agent_name_hint'), 'Shanhai Travel Assistant')
    const callback = new URL(auth.searchParams.get('redirect_uri'))
    callback.search = new URLSearchParams({ code: 'code1', client_id: 'issued-client', state: 'wrong' })
    await assert.rejects(coordinator.callback(login.id, callback.href), /state/)
    assert.equal(coordinator.status(login.id).status, 'pending')
    callback.searchParams.set('state', auth.searchParams.get('state'))
    // Test the actual HTTP loopback callback, not only the manual fallback.
    const response = await fetch(callback)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /ChatGPT 已连接/)
    assert.equal(coordinator.status(login.id).status, 'complete')
    assert.equal(tokenRequest.get('client_id'), 'issued-client')
    assert.equal(tokenRequest.get('redirect_uri'), auth.searchParams.get('redirect_uri'))
    assert.ok(tokenRequest.get('code_verifier'))
    await assert.rejects(coordinator.callback(login.id, callback.href), /已使用/)
    const returning = await coordinator.start()
    assert.equal(new URL(returning.url).searchParams.get('client_id'), 'issued-client')
    assert.equal(new URL(returning.url).searchParams.get('id_token_hint'), 'test-id')
    coordinator.cancel(returning.id)
    assert.equal(coordinator.status(returning.id).status, 'failed')
  } finally { coordinator.close() }
})

test('只登录身份但未授予订阅调用权限时，不保存可用凭据', async () => {
  const store = await createCredentialStore(await temp())
  const coordinator = createChatGPTLogin({ store, deviceId: '6a87c831-a2f7-4b03-b22d-04b1146f37e0', verify: async () => ({ sub: 'account-123' }), fetcher: async () => Response.json({ id_token: 'id', access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'openid profile email' }) })
  try {
    const login = await coordinator.start(), url = new URL(login.url)
    const callback = new URL(url.searchParams.get('redirect_uri'))
    callback.search = new URLSearchParams({ state: url.searchParams.get('state'), code: 'code', client_id: 'client' })
    await assert.rejects(coordinator.callback(login.id, callback.href), /未授权/)
    assert.equal(await store.read('openai'), undefined)
  } finally { coordinator.close() }
})

test('连接服务拒绝无连接码与陌生来源，模型列表由已授权账号获取', async () => {
  const bridge = await createBridge({ directory: await temp(), port: 0, fetcher: async url => {
    assert.equal(url, 'https://api.openai.com/v1/models')
    return Response.json({ models: [{ slug: 'travel-model', display_name: 'Travel Model', visibility: 'list' }, { slug: 'hidden', visibility: 'hidden' }] })
  } })
  const headers = { Authorization: `Bearer ${bridge.token}` }
  try {
    assert.equal((await fetch(`${bridge.url}/api/ai/status`)).status, 401)
    assert.equal((await fetch(`${bridge.url}/api/ai/status`, { headers: { ...headers, Origin: 'https://evil.example' } })).status, 403)
    assert.equal((await fetch(`${bridge.url}/api/ai/status`, { headers: { ...headers, Origin: 'https://xingzeye.github.io' } })).headers.get('Access-Control-Allow-Origin'), 'https://xingzeye.github.io')
    assert.equal((await (await fetch(`${bridge.url}/api/ai/status`, { headers })).json()).connected, false)
    await bridge.store.modify('openai', async () => ({ type: 'oauth', access: 'test', refresh: 'refresh', expires: Date.now() + 9999999, clientId: 'client', email: 'traveler@example.com' }))
    const catalog = await (await fetch(`${bridge.url}/api/ai/models`, { headers })).json()
    assert.deepEqual(catalog.models, [{ id: 'travel-model', name: 'Travel Model' }])
    assert.equal((await fetch(`${bridge.url}/api/ai/chat`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'hidden', messages: [{ role: 'user', text: '你好' }] }) })).status, 400)
    await fetch(`${bridge.url}/api/ai/logout`, { method: 'POST', headers })
    assert.equal(await bridge.store.read('openai'), undefined)
  } finally { await bridge.close() }
})

test('实际 pi-ai 流式适配器传入城市和多轮对话，输出增量文字并处理认证失败', async () => {
  const model = { id: 'mock-model', name: 'Mock', provider: 'custom', api: 'openai-completions', baseUrl: 'https://mock.example/v1', reasoning: false, input: ['text'], contextWindow: 32768, maxTokens: 4096, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, compat: { supportsDeveloperRole: false, supportsStore: false } }
  const models = createModels()
  models.setProvider(createProvider({ id: 'custom', models: [model], api: completionsApi, auth: { apiKey: { name: 'test', resolve: async () => ({ auth: { apiKey: 'test-key' } }) } } }))
  const history = [{ role: 'user', text: '先说说景点' }, { role: 'assistant', text: '可以参观园林。' }, { role: 'user', text: '那美食呢？' }]
  let payload
  const stream = models.stream(model, toContext(history, { city: '苏州市', province: '江苏' }, model), {
    maxRetries: 0, fetch: async (url, options) => {
      payload = JSON.parse(options.body)
      const chunks = [{ id: 'mock-id', object: 'chat.completion.chunk', model: model.id, choices: [{ index: 0, delta: { role: 'assistant', content: '苏州的' }, finish_reason: null }] }, { id: 'mock-id', object: 'chat.completion.chunk', model: model.id, choices: [{ index: 0, delta: { content: '美食' }, finish_reason: null }] }, { id: 'mock-id', object: 'chat.completion.chunk', model: model.id, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }]
      return new Response(chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
    },
  })
  let text = ''
  for await (const event of stream) if (event.type === 'text_delta') text += event.delta
  assert.equal(text, '苏州的美食')
  assert.match(payload.messages[0].content, /苏州市/)
  assert.match(payload.messages[0].content, /没有联网搜索工具/)
  assert.equal(payload.messages.at(-1).content, '那美食呢？')
  assert.equal(payload.messages[2].role, 'assistant')
  const denied = await models.complete(model, toContext(history, {}, model), { maxRetries: 0, fetch: async () => Response.json({ error: { message: 'Invalid API key' } }, { status: 401 }) })
  assert.equal(denied.stopReason, 'error')
})

test('订阅后端完整 Responses 流与重启后模型恢复，遵循订阅请求字段约定', async () => {
  const directory = await temp()
  let payload
  const mockFetch = async (url, options) => {
    if (String(url).endsWith('/models')) return Response.json({ models: [{ slug: 'travel-test', display_name: 'Test', visibility: 'list' }] })
    assert.ok(String(url).endsWith('/responses'))
    payload = JSON.parse(options.body)
    const message = { id: 'msg-test', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: '苏州旅行建议', annotations: [] }] }
    const response = { id: 'resp-test', object: 'response', created_at: Date.now() / 1000, model: 'travel-test', status: 'completed', output: [message], usage: { input_tokens: 12, output_tokens: 4, total_tokens: 16, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } }
    const events = [
      { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
      { type: 'response.output_item.added', output_index: 0, item: { ...message, status: 'in_progress', content: [] } },
      { type: 'response.content_part.added', item_id: message.id, output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } },
      { type: 'response.output_text.delta', item_id: message.id, output_index: 0, content_index: 0, delta: '苏州旅行建议' },
      { type: 'response.output_item.done', output_index: 0, item: message },
      { type: 'response.completed', response },
    ]
    return new Response(events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } })
  }
  const first = await createBridge({ directory, port: 0, fetcher: mockFetch })
  await first.store.modify('openai', async () => ({ type: 'oauth', access: 'test-token', refresh: 'test-refresh', expires: Date.now() + 9999999, clientId: 'client' }))
  await first.close()
  const restarted = await createBridge({ directory, port: 0, fetcher: mockFetch })
  try {
    const request = await fetch(`${restarted.url}/api/ai/chat`, { method: 'POST', headers: { Authorization: `Bearer ${restarted.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'travel-test', destination: { city: '苏州市', province: '江苏' }, messages: [{ role: 'user', text: '安排一天行程' }] }) })
    assert.equal(request.status, 200)
    const events = (await request.text()).trim().split('\n').map(line => JSON.parse(line))
    assert.equal(events.find(e => e.type === 'delta')?.text, '苏州旅行建议')
    assert.equal(events.at(-1).type, 'done')
    assert.equal(payload.store, false)
    assert.equal(payload.stream, true)
    assert.ok(!('max_output_tokens' in payload) && !('temperature' in payload) && !('prompt_cache_retention' in payload))
    assert.ok(!payload.input.some(item => item.role === 'system'))
    assert.match(JSON.stringify(payload), /苏州市/)
  } finally { await restarted.close() }
})

test('配置拒绝含凭据与不安全远程 HTTP，允许本机连接', () => {
  assert.equal(validateEndpoint('http://127.0.0.1:8787/'), 'http://127.0.0.1:8787')
  assert.throws(() => validateEndpoint('http://remote.example/v1'))
  assert.throws(() => validateEndpoint('https://user:pass@api.example/v1'))
  assert.throws(() => validateEndpoint('https://api.example/v1?key=secret'))
})
