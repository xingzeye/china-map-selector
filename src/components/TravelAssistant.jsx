import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { defaultConfig, friendlyError, providers, validateEndpoint } from '../ai/catalog'
import { bridgeRequest, streamReply } from '../ai/client'
import './TravelAssistant.css'

const SETTINGS_KEY = 'shanhai.ai.settings.v1'
const SECRETS_KEY = 'shanhai.ai.session.v1'
const HISTORY_KEY = 'shanhai.ai.history.v1'
const readStorage = (storage, key, fallback) => {
  try { return JSON.parse(storage.getItem(key)) || fallback } catch { return fallback }
}
const writeStorage = (storage, key, data) => {
  try { storage.setItem(key, JSON.stringify(data)); return true } catch { return false }
}
const initialConfig = () => ({ ...defaultConfig, ...readStorage(localStorage, SETTINGS_KEY, {}), ...readStorage(sessionStorage, SECRETS_KEY, {}) })
const loadHistory = () => {
  const data = readStorage(localStorage, HISTORY_KEY, [])
  return Array.isArray(data) ? data.filter(m => ['user', 'assistant'].includes(m.role) && typeof m.text === 'string').slice(-60) : []
}
const quickPrompts = [
  { icon: '◇', title: '值得一去的景点', note: '地标、小众去处与游览顺序', prompt: '推荐当前目的地值得去的景点，说明特色、适合人群和游览顺序。' },
  { icon: '♧', title: '跟着味蕾逛城市', note: '本地特色、吃法与寻味路线', prompt: '当前目的地有哪些特色美食？介绍代表菜品、口味，并规划一条寻味路线。' },
  { icon: '↗', title: '安排三天两夜', note: '每天的景点、美食与交通', prompt: '为当前目的地安排一份三天两夜的旅游行程，按上午、下午、晚上列出景点、美食和交通，说明预算假设。' },
  { icon: '≡', title: '整理我的旅行计划', note: '把聊天内容变成出行清单', prompt: '请总结我们已经讨论的旅行计划，整理成每日行程、交通安排、预算和出发前核实清单。信息不够时请先指出缺失项。' },
]

export default function TravelAssistant({ visible, destination, configureTick, selecting }) {
  const [config, setConfig] = useState(initialConfig)
  const [draft, setDraft] = useState(initialConfig)
  const [messages, setMessages] = useState(loadHistory)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [configNotice, setConfigNotice] = useState('')
  const [working, setWorking] = useState(false)
  const [account, setAccount] = useState(null)
  const [availableModels, setAvailableModels] = useState([])
  const [login, setLogin] = useState(null)
  const [callback, setCallback] = useState('')
  const [clearConfirm, setClearConfirm] = useState(false)
  const dialog = useRef(null)
  const bottom = useRef(null)
  const controller = useRef(null)
  const loginController = useRef(null)
  const sendLock = useRef(false)
  const savedDestination = useRef(destination)

  useEffect(() => () => { controller.current?.abort(); loginController.current?.abort() }, [])
  useEffect(() => {
    if (!busy) writeStorage(localStorage, HISTORY_KEY, messages.slice(-60))
  }, [messages, busy])
  useEffect(() => {
    const pane = bottom.current?.parentElement
    if (visible && pane) pane.scrollTop = pane.scrollHeight
  }, [messages, visible])
  useEffect(() => {
    if (configureTick) openSettings()
  }, [configureTick])
  useEffect(() => {
    if (savedDestination.current.city !== destination.city && messages.length) {
      setNotice(`目的地已更新为${destination.city || destination.province || '未选择'}，下次提问会使用新的目的地。`)
    }
    savedDestination.current = destination
  }, [destination.city, destination.province])

  function openSettings() {
    setDraft({ ...config }); setConfigNotice(''); setLogin(null); setCallback('')
    dialog.current?.showModal()
  }

  async function refreshAccount(settings = draft, signal) {
    const data = await (await bridgeRequest(settings, '/status', { signal })).json()
    setAccount(data.connected ? data.account : null)
    if (!data.connected) { setAvailableModels([]); return data }
    const catalog = await (await bridgeRequest(settings, '/models', { signal })).json()
    setAvailableModels(catalog.models)
    setDraft(prev => ({ ...prev, model: catalog.models.some(m => m.id === prev.model) ? prev.model : catalog.models[0]?.id || '' }))
    return data
  }

  async function connectBridge() {
    setWorking(true); setConfigNotice('正在连接…')
    try {
      const data = await refreshAccount(draft, AbortSignal.timeout(45000))
      setConfigNotice(data.connected ? 'ChatGPT 已连接，已加载账号可用模型。' : '连接服务正常，请点击下方按钮登录 ChatGPT。')
    } catch (error) { setAccount(null); setAvailableModels([]); setConfigNotice(friendlyError(error)) }
    finally { setWorking(false) }
  }

  async function startLogin() {
    setWorking(true); setConfigNotice('正在创建授权…')
    const popup = window.open('about:blank', 'shanhai-chatgpt-login', 'width=580,height=760')
    if (popup) popup.opener = null
    const abort = new AbortController()
    loginController.current?.abort(); loginController.current = abort
    try {
      const data = await (await bridgeRequest(draft, '/login', { method: 'POST', body: '{}', signal: abort.signal })).json()
      setLogin(data)
      if (popup) popup.location.href = data.url
      setConfigNotice('请在授权窗口中登录并允许使用 ChatGPT 订阅。完成后此处会自动更新。')
      while (!abort.signal.aborted) {
        await new Promise(resolve => {
          const done = () => { clearTimeout(timer); abort.signal.removeEventListener('abort', done); resolve() }
          const timer = setTimeout(done, 1500)
          abort.signal.addEventListener('abort', done, { once: true })
        })
        if (abort.signal.aborted) break
        const state = await (await bridgeRequest(draft, `/login/${data.id}`, { signal: abort.signal })).json()
        if (state.status === 'failed') throw new Error(state.error)
        if (state.status === 'complete') {
          await refreshAccount(draft, abort.signal)
          setLogin(null); setConfigNotice('ChatGPT 授权成功。请选择模型，保存后即可聊天。')
          break
        }
      }
    } catch (error) {
      if (!abort.signal.aborted) { popup?.close(); setConfigNotice(friendlyError(error)) }
    } finally { setWorking(false) }
  }

  async function cancelLogin() {
    loginController.current?.abort()
    if (login) await bridgeRequest(draft, `/login/${login.id}`, { method: 'DELETE' }).catch(() => {})
    setLogin(null); setWorking(false)
  }

  async function submitCallback(event) {
    event.preventDefault()
    try {
      await bridgeRequest(draft, `/login/${login.id}/callback`, { method: 'POST', body: JSON.stringify({ url: callback }) })
      setCallback(''); setConfigNotice('已提交回调，正在验证授权。')
    } catch (error) { setConfigNotice(friendlyError(error)) }
  }

  async function disconnect() {
    setWorking(true)
    try {
      await bridgeRequest(draft, '/logout', { method: 'POST', body: '{}' })
      setAccount(null); setAvailableModels([]); setDraft(prev => ({ ...prev, model: '' })); setConfigNotice('已退出 ChatGPT，连接服务中的订阅凭据已清除。')
    } catch (error) { setConfigNotice(friendlyError(error)) }
    finally { setWorking(false) }
  }

  function saveSettings(event) {
    event.preventDefault()
    try {
      if (draft.mode === 'subscription') {
        validateEndpoint(draft.bridgeUrl, '连接服务地址')
        if (!draft.bridgeToken.trim()) throw new Error('请填写连接码。')
      } else {
        const preset = providers.find(p => p.id === draft.provider)
        validateEndpoint(draft.baseUrl || preset.baseUrl)
        if (!draft.apiKey.trim() || !draft.model.trim()) throw new Error('请填写 API Key 和模型 ID。')
      }
      const { apiKey, bridgeToken, ...preferences } = draft
      const stored = writeStorage(localStorage, SETTINGS_KEY, preferences) && writeStorage(sessionStorage, SECRETS_KEY, { apiKey, bridgeToken })
      setConfig({ ...draft }); dialog.current?.close(); setNotice(stored ? '模型配置已保存。密钥和连接码仅在当前浏览器会话中保留。' : '本次配置已启用，浏览器禁止存储，刷新后需要重新填写。')
    } catch (error) { setConfigNotice(friendlyError(error)) }
  }

  async function testConnection() {
    setWorking(true); setConfigNotice('正在发送一条简短测试消息…')
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 45000)
    try {
      let text = ''
      await streamReply(draft, [{ role: 'user', text: '请仅回复“连接成功”。' }], {}, { signal: abort.signal, onDelta: delta => { text += delta } })
      setConfigNotice(`模型连接成功：${text.slice(0, 100)}`)
    } catch (error) { setConfigNotice(abort.signal.aborted ? '测试超时，请检查网络后重试。' : friendlyError(error)) }
    finally { clearTimeout(timeout); setWorking(false) }
  }

  async function send(text = input) {
    const question = text.trim()
    if (!question || sendLock.current || selecting) return
    if ((config.mode === 'subscription' && (!config.bridgeToken || !config.model)) || (config.mode === 'api' && (!config.apiKey || !config.model))) {
      openSettings(); setConfigNotice('请先完成模型连接。保存配置后，再发送你的问题。'); setInput(question); return
    }
    sendLock.current = true; setBusy(true); setInput(''); setNotice('')
    const id = crypto.randomUUID()
    const user = { id: crypto.randomUUID(), role: 'user', text: question, timestamp: Date.now(), city: destination.city || destination.province }
    const history = [...messages, user].slice(-60)
    setMessages([...history, { id, role: 'assistant', text: '', timestamp: Date.now() }])
    const abort = new AbortController(); controller.current = abort
    const timeout = setTimeout(() => abort.abort('timeout'), 180000)
    let received = ''
    try {
      await streamReply(config, history, { ...destination }, {
        signal: abort.signal,
        onDelta: delta => { received += delta; setMessages(prev => prev.map(m => m.id === id ? { ...m, text: received } : m)) },
      })
    } catch (error) {
      const stopped = abort.signal.aborted
      const reason = stopped ? (abort.signal.reason === 'timeout' ? '生成超时，请重试。' : '已停止生成。') : friendlyError(error)
      setNotice(reason)
      setMessages(prev => prev.map(m => m.id === id ? { ...m, text: received || reason, failed: !received } : m))
    } finally {
      clearTimeout(timeout); setBusy(false); sendLock.current = false; controller.current = null
    }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setNotice('已复制，可粘贴到备忘录或旅行文档。') }
    catch { setNotice('浏览器未允许复制，请选中文字手动复制。') }
  }

  function exportChat() {
    const text = `# 山海之间 · 旅行对话\n\n${messages.map(m => `## ${m.role === 'user' ? '我' : '旅行助手'}${m.city ? ` · ${m.city}` : ''}\n\n${m.text}`).join('\n\n')}`
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'shanhai-travel-plan.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <>
    <section hidden={!visible} className="assistant-layout" aria-label="AI 旅行助手">
      <aside className="travel-brief">
        <p className="section-index">YOUR NEXT JOURNEY</p>
        <span className="travel-symbol" aria-hidden="true">✦</span>
        <p className="travel-caption">让灵感，变成旅程。</p>
        <h2>{selecting ? '正在探索…' : destination.city || destination.province || '还没决定去哪？'}</h2>
        <p className="travel-context">{destination.city ? `${destination.province} · 地图已选目的地` : '先在地图里选一座城市，或直接告诉我你想去哪里。'}</p>
        {destination.food && <p className="travel-food">风味灵感 · {destination.food}</p>}
        <div className="travel-ideas">
          {quickPrompts.map(p => <button key={p.title} type="button" onClick={() => send(p.prompt)} disabled={busy || selecting}>
            <span aria-hidden="true">{p.icon}</span><span><strong>{p.title}</strong><small>{p.note}</small></span><span aria-hidden="true">↗</span>
          </button>)}
        </div>
        <p className="travel-note">旅行建议由 AI 生成。开放时间、票价与预约要求，请出发前向官方核实。</p>
      </aside>
      <article className="chat-panel">
        <div className="chat-header">
          <div><p className="section-index">04 / TRAVEL COMPANION</p><h2>AI 旅行助手 <span>✦</span></h2></div>
          <button type="button" className="model-badge" onClick={openSettings} disabled={busy}>{config.model || '连接模型'} <span aria-hidden="true">⌄</span></button>
        </div>
        <div className="chat-toolbar">
          <span>{config.mode === 'subscription' ? 'ChatGPT 订阅' : providers.find(p => p.id === config.provider)?.name} · {config.model ? '已选择模型' : '待配置'}</span>
          <div><button type="button" onClick={exportChat} disabled={!messages.length || busy}>导出对话</button><button type="button" disabled={!messages.length || busy} onClick={() => setClearConfirm(true)}>新对话</button></div>
        </div>
        {clearConfirm && <div className="chat-confirm" role="alert">清空当前对话，开启新的旅行计划？<button onClick={() => { setMessages([]); setClearConfirm(false); setNotice('') }}>清空</button><button onClick={() => setClearConfirm(false)}>取消</button></div>}
        <div className="chat-messages" role="log" aria-label="旅行对话记录" aria-busy={busy}>
          {!messages.length && <div className="chat-welcome"><span aria-hidden="true">山</span><h3>下一段旅程，一起想想。</h3><p>从一座城市、一口风味开始。<br />问我景点、美食，或一起把行程排好。</p><div className="welcome-tags"><span>城市攻略</span><span>美食路线</span><span>行程规划</span></div></div>}
          {messages.map(message => <div key={message.id} className={`chat-message ${message.role} ${message.failed ? 'failed' : ''}`}>
            <span className="message-author">{message.role === 'user' ? '你' : '✦ 旅行助手'}{message.city && <small>{message.city}</small>}</span>
            <div className="message-content">{message.text ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: props => <a {...props} target="_blank" rel="noopener noreferrer" /> }}>{message.text}</ReactMarkdown> : <span className="typing-label">正在构思你的旅程…</span>}</div>
            {message.role === 'assistant' && message.text && !busy && !message.failed && <button type="button" className="copy-message" onClick={() => copy(message.text)}>复制内容</button>}
          </div>)}
          <div ref={bottom} />
        </div>
        {notice && <p className="chat-notice" role="status">{notice}</p>}
        <form className="chat-composer" onSubmit={event => { event.preventDefault(); send() }}>
          <label className="sr-only" htmlFor="travel-question">发送给旅行助手的问题</label>
          <textarea id="travel-question" value={input} onChange={e => setInput(e.target.value)} rows={2} maxLength={8000} placeholder={destination.city ? `问问${destination.city}有哪些值得去的地方…` : '告诉我你想去哪，或问一个旅行问题…'} disabled={selecting} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && window.matchMedia('(min-width: 761px)').matches) { event.preventDefault(); send() }
          }} />
          <div className="composer-footer"><span>{selecting ? '目的地确定后即可提问' : '支持连续对话 · Shift + Enter 换行'}</span>{busy ? <button type="button" onClick={() => controller.current?.abort()}>停止生成 ■</button> : <button type="submit" disabled={!input.trim() || selecting}>发送 <span aria-hidden="true">↑</span></button>}</div>
        </form>
      </article>
    </section>

    <dialog ref={dialog} className="model-dialog" onCancel={() => { cancelLogin() }} onClose={() => { cancelLogin() }}>
      <div className="model-dialog-header"><div><p className="section-index">MODEL CONNECTION</p><h2>连接你的 AI 模型</h2></div><button type="button" aria-label="关闭模型配置" onClick={() => dialog.current?.close()}>×</button></div>
      <div className="connection-tabs" aria-label="模型接入方式"><button type="button" className={draft.mode === 'subscription' ? 'active' : ''} disabled={working} onClick={() => { setDraft(prev => ({ ...prev, mode: 'subscription', model: '' })); setConfigNotice('') }}>ChatGPT 订阅</button><button type="button" className={draft.mode === 'api' ? 'active' : ''} disabled={working} onClick={() => { setDraft(prev => ({ ...prev, mode: 'api', model: providers.find(p => p.id === prev.provider)?.model || '' })); setConfigNotice('') }}>API Key / 自定义接口</button></div>
      <form onSubmit={saveSettings} className="model-form">
        {draft.mode === 'subscription' ? <>
          <p className="config-description">使用 ChatGPT Plus / Pro 订阅。先启动本机连接服务，再登录并授权使用订阅。</p>
          <div className="bridge-guide"><strong>首次连接 · 在本机项目目录运行</strong><code>npm run ai:server</code><span>启动后打开本机连接页复制连接码。在线页面访问本机时，请允许浏览器的“本地网络访问”。</span><a href="http://127.0.0.1:8787/connect" target="_blank" rel="noopener noreferrer">打开本机连接页 ↗</a><a href="https://github.com/xingzeye/china-map-selector/blob/master/AI_SETUP.md" target="_blank" rel="noopener noreferrer">查看完整接入说明 ↗</a></div>
          <label>连接服务地址<input value={draft.bridgeUrl} onChange={e => { setAccount(null); setAvailableModels([]); setDraft(prev => ({ ...prev, bridgeUrl: e.target.value, model: '' })) }} placeholder="http://127.0.0.1:8787" type="url" disabled={working} /></label>
          <label>连接码<input type="password" value={draft.bridgeToken} autoComplete="off" onChange={e => { setAccount(null); setAvailableModels([]); setDraft(prev => ({ ...prev, bridgeToken: e.target.value, model: '' })) }} placeholder="复制启动终端显示的连接码" disabled={working} /></label>
          <div className="connection-actions"><button type="button" onClick={connectBridge} disabled={working || !draft.bridgeToken}>连接服务 / 刷新模型</button><button type="button" className="chatgpt-login" onClick={startLogin} disabled={working || !draft.bridgeToken}>Continue with ChatGPT ↗</button></div>
          {account && <div className="account-status"><span>● 已连接 · {account.email || 'ChatGPT 账号'}</span><button type="button" onClick={disconnect} disabled={working}>退出订阅</button></div>}
          <label>账号可用模型<select aria-label="账号可用模型" value={draft.model} disabled={working || !availableModels.length} onChange={e => setDraft(prev => ({ ...prev, model: e.target.value }))}><option value="">{availableModels.length ? '请选择模型' : '登录后从账号加载'}</option>{availableModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        </> : <>
          <p className="config-description">填写你自己的服务商密钥；请求从当前浏览器发往所填接口。接口需要允许跨域访问。</p>
          <label>服务商<select aria-label="服务商" value={draft.provider} disabled={working} onChange={e => { const p = providers.find(p => p.id === e.target.value); setDraft(prev => ({ ...prev, provider: p.id, api: p.api, baseUrl: p.baseUrl, model: p.model, apiKey: '' })) }}>{providers.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
          <label>接口地址（Base URL）<input type="url" value={draft.baseUrl} onChange={e => setDraft(prev => ({ ...prev, baseUrl: e.target.value }))} placeholder={providers.find(p => p.id === draft.provider)?.baseUrl || 'https://你的服务商/v1'} disabled={working} /></label>
          {draft.provider === 'custom' && <label>接口协议<select aria-label="接口协议" value={draft.api} onChange={e => setDraft(prev => ({ ...prev, api: e.target.value }))} disabled={working}><option value="openai-completions">OpenAI Chat Completions</option><option value="openai-responses">OpenAI Responses</option><option value="anthropic-messages">Anthropic Messages</option></select></label>}
          <label>API Key<input type="password" value={draft.apiKey} autoComplete="off" onChange={e => setDraft(prev => ({ ...prev, apiKey: e.target.value }))} placeholder="输入服务商提供的密钥" disabled={working} /></label>
          <label>模型 ID<input value={draft.model} onChange={e => setDraft(prev => ({ ...prev, model: e.target.value }))} placeholder="填写服务商提供的准确模型 ID" disabled={working} /></label>
        </>}
        <p className="config-privacy">模型设置保存在此设备；密钥与连接码仅保留在当前浏览器会话。ChatGPT 授权凭据由本机服务加密保存。对话记录保存在此浏览器，可用“新对话”清空。</p>
        {configNotice && <p className="config-notice" role="status">{configNotice}</p>}
        <div className="model-dialog-footer"><button type="button" onClick={testConnection} disabled={working || !draft.model}>测试模型连接</button><button type="submit" className="save-config" disabled={working}>保存配置</button></div>
        <small className="test-cost-note">连接测试会发送一条简短消息，使用少量模型额度。</small>
      </form>
      {login && <div className="oauth-progress"><a href={login.url} target="_blank" rel="noopener noreferrer">重新打开 ChatGPT 授权窗口 ↗</a><p>如果授权窗口显示本机回调无法访问，复制地址栏完整 URL，粘贴到这里继续。</p><form onSubmit={submitCallback}><label>完整回调 URL<input type="url" value={callback} onChange={e => setCallback(e.target.value)} placeholder="http://127.0.0.1:端口/auth/callback?..." /></label><button type="submit" disabled={!callback.trim()}>提交回调</button><button type="button" onClick={cancelLogin}>取消登录</button></form></div>}
    </dialog>
  </>
}
