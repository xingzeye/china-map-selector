import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createModels } from '@earendil-works/pi-ai'
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai'
import { createCredentialStore, installationInfo } from './credential-store.mjs'
import { createChatGPTLogin } from './chatgpt-oauth.mjs'
import { toContext } from '../src/ai/catalog.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultOrigins = ['https://china-map-selector.xzy666999.chatgpt.site', 'https://xingzeye.github.io', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173']
const json = (response, status, value) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)) }
const equal = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y) }

async function readBody(request) {
  let bytes = 0
  const chunks = []
  for await (const part of request) {
    bytes += part.length
    if (bytes > 256000) throw new Error('请求太大，请开启新对话后重试。')
    chunks.push(part)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { throw new Error('请求 JSON 格式不正确。') }
}

export async function createBridge({ directory = path.join(root, '.ai-local'), port = 8787, fetcher = fetch, verify } = {}) {
  const store = await createCredentialStore(directory)
  const installation = await installationInfo(directory)
  const oauth = createChatGPTLogin({ store, deviceId: installation.deviceId, fetcher, verify })
  const provider = openaiProvider()
  const models = createModels({ credentials: store, authContext: { env: async () => undefined, fileExists: async () => false } })
  models.setProvider({ ...provider, auth: { ...provider.auth, oauth: {
    ...provider.auth.oauth,
    refresh: async (previous, signal) => ({ ...previous, ...await provider.auth.oauth.refresh(previous, signal) }),
  } } })
  const origins = new Set([...defaultOrigins, ...(process.env.AI_ALLOWED_ORIGINS || '').split(',').filter(Boolean)])
  const activeRequests = new Set()
  let catalog = []
  async function loadCatalog() {
    const auth = await models.getAuth('openai', { signal: AbortSignal.timeout(45000) })
    if (!auth?.auth.apiKey) throw new Error('请先登录 ChatGPT。')
    const result = await fetcher('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${auth.auth.apiKey}` }, signal: AbortSignal.timeout(45000) })
    if (!result.ok) throw new Error(`ChatGPT 模型列表加载失败（${result.status}），请重新授权。`)
    const data = await result.json()
    if (!Array.isArray(data.models)) throw new Error('ChatGPT 模型列表格式不符合订阅接口约定。')
    catalog = data.models.filter(m => m.visibility === 'list' && typeof m.slug === 'string').map(m => ({ id: m.slug, name: m.display_name || m.slug }))
    if (!catalog.length) throw new Error('此账号没有可显示的订阅模型。请检查订阅权限。')
    return catalog
  }
  const server = createServer(async (request, response) => {
    const expectedHost = `127.0.0.1:${server.address().port}`
    const localhostHost = `localhost:${server.address().port}`
    if (![expectedHost, localhostHost].includes(request.headers.host)) { json(response, 403, { error: '不允许此 Host。' }); return }
    const url = new URL(request.url, `http://${expectedHost}`)
    const origin = request.headers.origin
    if (origin && !origins.has(origin) && ![`http://${expectedHost}`, `http://${localhostHost}`].includes(origin)) { json(response, 403, { error: '不允许此页面连接本机服务。' }); return }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
      response.setHeader('Access-Control-Allow-Private-Network', 'true')
    }
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }
    if (url.pathname.startsWith('/api/ai')) {
      if (!equal(request.headers.authorization || '', `Bearer ${installation.bridgeToken}`)) { json(response, 401, { error: '连接码不正确，请从本机连接服务复制连接码。' }); return }
      try {
        const route = url.pathname.slice('/api/ai'.length)
        if (route === '/status' && request.method === 'GET') {
          const credential = await store.read('openai')
          json(response, 200, { connected: credential?.type === 'oauth', account: credential ? { email: credential.email || '', subscription: true } : null }); return
        }
        if (route === '/login' && request.method === 'POST') { json(response, 200, await oauth.start()); return }
        const match = route.match(/^\/login\/([0-9a-f-]+)(\/callback)?$/)
        if (match) {
          if (request.method === 'GET' && !match[2]) { json(response, 200, oauth.status(match[1])); return }
          if (request.method === 'DELETE' && !match[2]) { oauth.cancel(match[1]); json(response, 200, { ok: true }); return }
          if (request.method === 'POST' && match[2]) { const body = await readBody(request); await oauth.callback(match[1], body.url); json(response, 200, { ok: true }); return }
        }
        if (route === '/logout' && request.method === 'POST') { oauth.close(); await models.logout('openai'); catalog = []; json(response, 200, { ok: true }); return }
        if (route === '/models' && request.method === 'GET') {
          json(response, 200, { models: await loadCatalog() }); return
        }
        if (route === '/chat' && request.method === 'POST') {
          const body = await readBody(request)
          if (!Array.isArray(body.messages) || !body.messages.length || body.messages.length > 60 || body.messages.some(m => !['user', 'assistant'].includes(m.role) || typeof m.text !== 'string' || m.text.length > 50000)) throw new Error('对话格式不正确或过长，请开启新对话。')
          if (!(await store.read('openai'))) throw new Error('请先登录 ChatGPT。')
          if (!catalog.length) await loadCatalog()
          if (!catalog.some(m => m.id === body.model)) throw new Error('请刷新模型列表并选择账号可用模型。')
          if (activeRequests.size) { json(response, 429, { error: '已有一条回复正在生成，请等待或停止。' }); return }
          const model = models.getModel('openai', body.model) || {
            id: body.model, name: body.model, provider: 'openai', api: 'openai-responses', baseUrl: 'https://api.openai.com/v1',
            reasoning: false, input: ['text'], contextWindow: 32768, maxTokens: 4096, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          }
          const abort = new AbortController(); activeRequests.add(abort)
          const timer = setTimeout(() => abort.abort(), 180000)
          response.on('close', () => { if (!response.writableEnded) abort.abort() })
          response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
          response.flushHeaders()
          const send = event => { if (!response.destroyed) response.write(`${JSON.stringify(event)}\n`) }
          try {
            const stream = models.stream(model, toContext(body.messages, body.destination || {}, model), {
              signal: abort.signal, maxRetries: 0, fetch: fetcher,
              onPayload: payload => {
                payload.store = false; payload.stream = true
                for (const key of ['max_output_tokens', 'temperature', 'top_p', 'prompt_cache_retention', 'prompt_cache_options', 'previous_response_id']) delete payload[key]
                payload.input = payload.input.map(item => item.role === 'system' ? { ...item, role: 'developer' } : item)
                return payload
              },
            })
            for await (const event of stream) {
              if (event.type === 'text_delta') send({ type: 'delta', text: event.delta })
              if (event.type === 'error') throw new Error(event.error.errorMessage || '模型请求失败。')
            }
            const result = await stream.result()
            if (!result.content.some(b => b.type === 'text' && b.text.trim())) throw new Error('模型没有返回文字，请换一个聊天模型。')
            send({ type: 'done' })
          } catch (error) { send({ type: 'error', error: abort.signal.aborted ? '已停止生成。' : String(error.message).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 450) }) }
          finally { clearTimeout(timer); activeRequests.delete(abort); response.end() }
          return
        }
        json(response, 404, { error: '接口不存在。' })
      } catch (error) { if (!response.headersSent) json(response, 400, { error: error.message }) }
      return
    }
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return }
    if (url.pathname === '/connect') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Referrer-Policy': 'no-referrer' })
      response.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>山海之间 · 本机连接</title><body style="max-width:700px;margin:60px auto;padding:20px;font:16px sans-serif;color:#234b3b"><h1>山海之间 · 本机连接服务</h1><p>连接服务已启动。将下面地址和连接码粘贴到网站的“模型配置 → ChatGPT 订阅”。</p><p>服务地址：<code>http://${expectedHost}</code></p><p>连接码（仅用于你的本机）：</p><pre style="padding:20px;background:#edf4e7;overflow-wrap:anywhere;white-space:pre-wrap;user-select:all">${installation.bridgeToken}</pre><p>然后点击“连接服务”，再点击 Continue with ChatGPT。</p><p>在线页面访问本机时，请允许浏览器的本地网络访问权限。如果浏览器阻止连接，可以从本机网站登录。</p><p><a href="/china-map-selector/">打开本机网站 ↗</a></p></body></html>`)
      return
    }
    // Serve either GitHub Pages or root-path builds for the local OAuth companion.
    let relative
    try { relative = decodeURIComponent(url.pathname).replace(/^\/china-map-selector(?=\/|$)/, '').replace(/^\/+/, '') || 'index.html' }
    catch { response.writeHead(400); response.end(); return }
    const dist = path.join(root, 'dist')
    const file = path.resolve(dist, relative)
    if (!file.startsWith(`${dist}${path.sep}`)) { response.writeHead(403); response.end(); return }
    try {
      if (!(await stat(file)).isFile()) throw new Error('Not a file')
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' }
      response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' }); response.end(await readFile(file))
    } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('文件未找到。请先运行 npm run build。') }
  })
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
  return {
    server, store, token: installation.bridgeToken,
    url: `http://127.0.0.1:${server.address().port}`,
    close: async () => { oauth.close(); activeRequests.forEach(c => c.abort()); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) },
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const bridge = await createBridge({ port: Number(process.env.AI_PORT || 8787) })
  console.log(`山海之间 AI 连接服务已启动：${bridge.url}\n在浏览器打开 ${bridge.url}/connect 查看连接码。\n使用 Ctrl+C 停止服务。`)
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await bridge.close(); process.exit(0) })
}
