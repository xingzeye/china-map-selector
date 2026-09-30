export const providers = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', api: 'openai-responses' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', api: 'openai-completions' },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '', api: 'openai-completions' },
  { id: 'anthropic', name: 'Anthropic / Claude API', baseUrl: 'https://api.anthropic.com', model: '', api: 'anthropic-messages' },
  { id: 'google', name: 'Google / Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: '', api: 'google-generative-ai' },
  { id: 'custom', name: '自定义 OpenAI 兼容接口 / Coding Plan', baseUrl: '', model: '', api: 'openai-completions' },
]

export const defaultConfig = {
  mode: 'subscription', provider: 'openai', model: '', baseUrl: '', api: 'openai-responses',
  bridgeUrl: 'http://127.0.0.1:8787', apiKey: '', bridgeToken: '',
}

export function validateEndpoint(value, label = '接口地址') {
  let url
  try { url = new URL(value) } catch { throw new Error(`${label}需要填写完整的 http:// 或 https:// 地址。`) }
  if (url.username || url.password || url.search || url.hash) throw new Error(`${label}不要包含账号、密码、查询参数或锚点。`)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error(`${label}请使用 HTTPS；本机服务可以使用 HTTP。`)
  }
  return url.toString().replace(/\/+$/, '')
}

export function travelPrompt(destination) {
  return `你是“山海之间”的中文旅行助手。帮助用户了解城市景点、本地美食、交通，并规划和总结旅行行程。
当前地图目的地：${destination?.city || '未选择城市'}；省份：${destination?.province || '未选择省份'}；美食灵感：${destination?.food || '未选择'}。
用户可以讨论其他城市；当前目的地变化时不要把之前城市的景点混入新行程。未选城市时先询问目的地，普通聊天可直接回答。
行程优先按天、上午/下午/晚上安排，考虑地理顺序、交通、休息和天气，说明适合人群和预算的估算范围。信息不全时说明假设并提出少量必要问题。
你没有联网搜索工具。不要声称已查询实时信息，不要捏造票价、营业时间、店铺现状、实时天气或来源链接。对可能变化的预约、开放、交通和费用明确建议出发前向官方核实。
对景点与美食提供具体、有用、简洁的建议；涉及过敏和饮食偏好时提醒用户确认。用 Markdown 清晰排版。`
}

export function toContext(messages, destination, model) {
  return {
    systemPrompt: travelPrompt(destination),
    messages: messages.filter(m => m.text && !m.failed).slice(-40).map(m => m.role === 'user'
      ? { role: 'user', content: m.text, timestamp: m.timestamp || Date.now() }
      : {
          role: 'assistant', content: [{ type: 'text', text: m.text }], timestamp: m.timestamp || Date.now(),
          api: model.api, provider: model.provider, model: model.id, stopReason: 'stop',
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        }),
  }
}

export function friendlyError(error) {
  const message = error?.message || String(error)
  if (/abort|cancel/i.test(message)) return '已停止生成。'
  if (/401|unauthorized|invalid.*key/i.test(message)) return '认证失败，请检查 API Key 或重新登录 ChatGPT。'
  if (/subscription_sharing_usage_limit_exceeded|429|rate.limit|quota/i.test(message)) return '当前模型额度不足或请求过于频繁，请稍后重试，或检查订阅额度。'
  if (/403|permission|access.denied/i.test(message)) return '账号没有此模型的使用权限，或未授权使用 ChatGPT 订阅。请重新授权或更换模型。'
  if (/404|model.*not.*found/i.test(message)) return '没有找到这个模型或接口，请检查模型 ID 和服务地址。'
  if (/fetch|network|connection|cors/i.test(message)) return '连接失败。订阅模式请确认本机连接服务已启动、连接码正确，并允许浏览器访问本机；API 模式请检查网络和接口的跨域支持。'
  return message.slice(0, 450)
}
