import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'

const issuer = 'https://auth.openai.com'
const resource = 'https://api.openai.com/v1'
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
const randomValue = () => randomBytes(32).toString('base64url')

export async function verifyIdentity(token, clientId, nonce, keySet = jwks) {
  const { payload } = await jwtVerify(token, keySet, { issuer, audience: clientId, requiredClaims: ['sub', 'exp', 'iat'], clockTolerance: 5 })
  if (payload.nonce !== nonce || typeof payload.sub !== 'string' || !payload.sub) throw new Error('ChatGPT 身份验证失败，请重新登录。')
  return payload
}

export function createChatGPTLogin({ store, deviceId, fetcher = fetch, verify = verifyIdentity }) {
  const sessions = new Map()

  function close(session) {
    clearTimeout(session.timeout)
    session.server?.close()
    session.server?.closeIdleConnections()
  }

  async function complete(session, url) {
    if (session.status !== 'pending' || session.consumed) throw new Error('此授权已使用、取消或过期，请重新登录。')
    if (url.origin !== new URL(session.redirectUri).origin || url.pathname !== '/auth/callback') throw new Error('回调地址与本次登录不一致。')
    if (url.searchParams.get('state') !== session.state) throw new Error('OAuth state 不匹配，请使用本次登录的完整回调地址。')
    session.consumed = true
    try {
      if (url.searchParams.get('error')) throw new Error('ChatGPT 授权未完成或被拒绝，请重新登录并允许订阅调用。')
      const code = url.searchParams.get('code')
      const clientId = url.searchParams.get('client_id') || session.previous?.clientId
      if (!code || !clientId || clientId === 'dynamic_agent_client') throw new Error('授权回调缺少 code 或已签发的 client_id。')
      if (session.previous?.clientId && clientId !== session.previous.clientId) throw new Error('回调的客户端与当前账号不一致。请先退出再连接其他账号。')
      const response = await fetcher(`${issuer}/api/accounts/oauth/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: session.verifier, redirect_uri: session.redirectUri, resource }),
        signal: AbortSignal.timeout(45000),
      })
      if (!response.ok) throw new Error(`ChatGPT 授权交换失败（${response.status}），请重新登录。`)
      const token = await response.json()
      if (!token.id_token || !token.access_token || !token.refresh_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error('ChatGPT 返回的授权凭据不完整，请重新登录。')
      const identity = await verify(token.id_token, clientId, session.nonce)
      if (session.previous?.subject && identity.sub !== session.previous.subject) throw new Error('登录账号与当前连接的账号不一致。请先退出后再添加新账号。')
      const scopes = typeof token.scope === 'string' ? token.scope.trim().split(/\s+/) : []
      if (!scopes.includes('chatgpt.tokens.use.direct')) throw new Error('账号已登录，但未授权使用 ChatGPT 订阅。请重新登录并允许订阅调用。')
      if (session.status !== 'pending') throw new Error('此授权已取消或过期，请重新登录。')
      await store.modify('openai', async () => ({
        type: 'oauth', access: token.access_token, refresh: token.refresh_token,
        expires: Date.now() + token.expires_in * 1000 - 180000,
        clientId, scopes, subject: identity.sub, email: identity.email || '', idToken: token.id_token,
      }))
      session.status = 'complete'
    } catch (error) { session.status = 'failed'; session.error = error.message; throw error }
    finally { close(session) }
  }

  return {
    async start() {
      if ([...sessions.values()].some(s => s.status === 'pending')) throw new Error('已有授权进行中，请先完成或取消。')
      for (const [id, s] of sessions) if (s.expiresAt < Date.now()) sessions.delete(id)
      const session = {
        id: randomUUID(), state: randomValue(), nonce: randomValue(), verifier: randomValue(),
        status: 'pending', consumed: false, expiresAt: Date.now() + 600000, previous: await store.read('openai'),
      }
      session.server = createServer(async (request, response) => {
        try {
          const url = new URL(request.url, session.redirectUri)
          if (url.pathname !== '/auth/callback') { response.writeHead(404); response.end('Not found'); return }
          await complete(session, url)
          response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' })
          response.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>ChatGPT 已连接</title><body style="font:18px sans-serif;padding:50px;color:#176b60"><h1>ChatGPT 已连接</h1><p>可以关闭此窗口，返回山海之间选择模型并保存配置。</p></body></html>')
        } catch {
          if (!response.destroyed) { response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); response.end('授权验证失败，请返回山海之间查看提示并重新登录。') }
        }
      })
      await new Promise((resolve, reject) => { session.server.once('error', reject); session.server.listen(0, '127.0.0.1', resolve) })
      session.redirectUri = `http://127.0.0.1:${session.server.address().port}/auth/callback`
      session.timeout = setTimeout(() => { session.status = 'failed'; session.error = '授权已过期，请重新登录。'; close(session) }, 600000)
      session.timeout.unref()
      sessions.set(session.id, session)
      const url = new URL(`${issuer}/api/accounts/authorize`)
      url.search = new URLSearchParams({
        client_id: session.previous?.clientId || 'dynamic_agent_client',
        ...(!session.previous?.clientId ? { agent_name_hint: 'Shanhai Travel Assistant' } : {}),
        ...(session.previous?.idToken ? { id_token_hint: session.previous.idToken } : {}),
        ext_agent_host_id: `urn:uuid:${deviceId}`, response_type: 'code', redirect_uri: session.redirectUri,
        scope: 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct', resource,
        state: session.state, nonce: session.nonce, code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(session.verifier).digest('base64url'),
      }).toString()
      return { id: session.id, url: url.toString(), expiresAt: session.expiresAt }
    },
    status(id) {
      const session = sessions.get(id)
      if (!session) throw new Error('授权会话不存在或已过期。')
      return { status: session.status, error: session.error }
    },
    async callback(id, value) {
      const session = sessions.get(id)
      if (!session) throw new Error('授权会话不存在。')
      let url
      try { url = new URL(value) } catch { throw new Error('请粘贴完整的回调 URL。') }
      await complete(session, url)
    },
    cancel(id) {
      const session = sessions.get(id)
      if (session?.status === 'pending') { session.status = 'failed'; session.error = '登录已取消。'; close(session) }
    },
    close() { for (const session of sessions.values()) { session.status = 'failed'; close(session) } },
  }
}
