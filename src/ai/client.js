import { providers, toContext, validateEndpoint } from './catalog'

export async function bridgeRequest(config, path, { signal, ...options } = {}) {
  const base = validateEndpoint(config.bridgeUrl, '连接服务地址')
  const response = await fetch(`${base}/api/ai${path}`, {
    ...options, signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.bridgeToken}`, ...options.headers },
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || `连接服务返回 ${response.status}`)
  }
  return response
}

export async function createApiClient(config) {
  if (!config.apiKey.trim()) throw new Error('请先填写 API Key。')
  if (!config.model.trim()) throw new Error('请填写模型 ID。')
  const preset = providers.find(p => p.id === config.provider) || providers[0]
  const baseUrl = validateEndpoint(config.baseUrl || preset.baseUrl)
  const { createModels, createProvider } = await import('@earendil-works/pi-ai')
  const api = config.provider === 'custom' ? config.api : preset.api
  const implementations = {
    'openai-responses': () => import('@earendil-works/pi-ai/api/openai-responses'),
    'openai-completions': () => import('@earendil-works/pi-ai/api/openai-completions'),
    'anthropic-messages': () => import('@earendil-works/pi-ai/api/anthropic-messages'),
    'google-generative-ai': () => import('@earendil-works/pi-ai/api/google-generative-ai'),
  }
  if (!implementations[api]) throw new Error('不支持此接口协议。')
  const model = {
    id: config.model.trim(), name: config.model.trim(), provider: config.provider, api, baseUrl,
    reasoning: false, input: ['text'], contextWindow: 32768, maxTokens: 4096,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    ...(api === 'openai-completions' ? { compat: { supportsDeveloperRole: false, supportsStore: false, maxTokensField: 'max_tokens' } } : {}),
  }
  const models = createModels()
  models.setProvider(createProvider({
    id: config.provider, baseUrl, models: [model], api: await implementations[api](),
    auth: { apiKey: { name: '用户 API Key', resolve: async () => ({ auth: { apiKey: config.apiKey.trim() } }) } },
  }))
  return { models, model }
}

export async function streamReply(config, messages, destination, { signal, onDelta }) {
  if (config.mode === 'subscription') {
    if (!config.bridgeToken) throw new Error('请先在模型配置中填写连接服务的连接码。')
    if (!config.model) throw new Error('请登录 ChatGPT 并选择可用模型。')
    const response = await bridgeRequest(config, '/chat', {
      method: 'POST', signal, body: JSON.stringify({ messages, destination, model: config.model }),
    })
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let pending = '', completed = false
    const consume = line => {
      if (!line.trim()) return
      const event = JSON.parse(line)
      if (event.type === 'delta') onDelta(event.text)
      if (event.type === 'error') throw new Error(event.error)
      if (event.type === 'done') completed = true
    }
    try {
      while (true) {
        const { value, done } = await reader.read()
        pending += decoder.decode(value, { stream: !done })
        const lines = pending.split('\n')
        pending = lines.pop()
        lines.forEach(consume)
        if (done) break
      }
      consume(pending)
      if (!completed && !signal?.aborted) throw new Error('响应中断，请重试。')
    } finally { await reader.cancel().catch(() => {}) }
    return
  }
  const { models, model } = await createApiClient(config)
  const stream = models.stream(model, toContext(messages, destination, model), {
    apiKey: config.apiKey.trim(), signal, maxTokens: 4096, maxRetries: 0,
  })
  for await (const event of stream) {
    if (event.type === 'text_delta') onDelta(event.delta)
    if (event.type === 'error') throw new Error(event.error.errorMessage || '模型返回错误。')
  }
  const result = await stream.result()
  if (!result.content.some(block => block.type === 'text' && block.text.trim()) && !signal?.aborted) throw new Error('模型没有返回文字，请检查模型是否支持聊天。')
}
