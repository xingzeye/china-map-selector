# AI 旅行助手接入说明

AI 功能使用 [`@earendil-works/pi-ai`](https://github.com/earendil-works/pi/blob/main/packages/ai/README.md) 统一模型请求与流式事件。默认接入方式为 **ChatGPT Plus / Pro 订阅登录**，同时支持用户自己的 API Key 和兼容接口。

## ChatGPT 订阅：首次使用

需要 Node.js **22.19.0 或更新版本**。在本机项目目录执行：

```powershell
npm ci
npm run build
npm run ai:server
```

1. 保持启动终端运行，打开 [本机连接页](http://127.0.0.1:8787/connect)，复制服务地址和连接码。
2. 打开 [Sites 站点](https://china-map-selector.xzy666999.chatgpt.site) 或 [GitHub Pages](https://xingzeye.github.io/china-map-selector/)，点击右上角 **模型配置 → ChatGPT 订阅**。
3. 服务地址填写 `http://127.0.0.1:8787`，粘贴连接码，点击 **连接服务 / 刷新模型**。
4. 点击 **Continue with ChatGPT**，在 OpenAI 授权窗口中登录并同意使用 ChatGPT 订阅。首次动态注册显示的应用名称为 `Shanhai Travel Assistant`。
5. 授权完成后，页面从该账号的订阅模型接口获取可选模型。选择模型，点击 **测试模型连接**，成功后 **保存配置**。
6. 在地图随机选择城市，点击 **问问 AI · 景点、美食与行程**；也可以打开 **AI 旅行助手** 直接提问。

在线页面连接本机时，浏览器可能询问“本地网络访问”权限，需要允许访问。如果浏览器阻止 HTTPS 页面连接本机 HTTP 服务，可打开 [本机网站](http://127.0.0.1:8787/china-map-selector/) 使用同样功能。`npm run build:sites` 产物也可由本机服务在根路径及 `/china-map-selector/` 路径提供。

本机连接服务必须持续运行。重启电脑后重新执行 `npm run ai:server`；授权凭据和安装标识会从本机恢复，刷新模型列表后可继续使用。可用模型和额度取决于账号实际授权与订阅状态。账号登录成功不等于拥有所有模型权限，完成一次真实推理才验证所选模型可用。

如回调窗口未能访问本机监听地址，可将该窗口地址栏中的 **完整回调 URL** 粘贴到配置对话框的回调输入栏。地址必须对应本次授权，包含 `state`、`code`，首次注册还需要已签发的 `client_id`。不要在聊天、GitHub issue 或日志中分享回调 URL。

## API Key / 自定义接口

切换到 **模型配置 → API Key / 自定义接口**：

- 选择 OpenAI、DeepSeek、OpenRouter、Anthropic、Google 或自定义接口。
- 填写服务商提供的准确模型 ID 与 API Key。自定义接口可选择 OpenAI Chat Completions、OpenAI Responses 或 Anthropic Messages 协议。
- Base URL 填服务根路径，例如 OpenAI 的 `https://api.openai.com/v1`；不要填写完整的 `/chat/completions` 请求路径，也不要在 URL 中放密钥。
- Coding Plan 与按量 API 的地址和权限可能不同，请按订阅服务商的说明填写。
- 点击 **测试模型连接** 后再保存；测试会使用少量额度。

API Key 模式由当前浏览器直接请求服务商，需要服务商允许 CORS。ChatGPT 订阅凭据不会作为 API Key 返回浏览器。当前 Node 连接服务专用于个人 ChatGPT 订阅，不是公共共享密钥代理。

## 数据保存与退出

- 模型名称、接口地址等非秘密配置：浏览器 `localStorage`。
- API Key 与本机连接码：浏览器 `sessionStorage`，仅在当前标签页会话中保留；关闭标签页或清除网站数据后需要重新填写。
- 最近 60 条文字对话：当前浏览器 `localStorage`。**新对话 → 清空** 清除这些记录；**导出对话** 下载 Markdown。
- ChatGPT 凭据：项目内 `.ai-local/credentials.enc`，使用 AES-256-GCM 加密；加密密钥为同目录 `encryption.key`。这两个文件和 `installation.json` 均被 Git 忽略，不能上传、公开或分享。拥有这些本机文件的账号仍能访问授权，请使用自己的系统账号。
- **退出订阅** 清除连接服务保存的凭据。需要从 OpenAI 侧撤销授权时，在 ChatGPT 的应用授权设置中管理。

服务默认只监听 `127.0.0.1`，使用随机连接码，并限制 `Origin` 与 `Host`。它是 **单用户本机连接服务**，不应改成公网监听后直接供多个访客使用。每位网站访客使用自己的本机连接服务及订阅。

## 接入实现与部署边界

- OAuth 按 [OpenAI 开源应用注册与登录流程](https://developers.openai.com/siwc/token-sharing-open-source/sign-in) 实现：PKCE、随机 state/nonce、HTTP loopback 回调、issued client ID、JWKS 签名与 issuer/audience/expiration/nonce 校验。
- 先验证身份，再检查 `chatgpt.tokens.use.direct` 权限；返回账号重授权需匹配已验证 subject。凭据变更串行写入并原子替换文件。
- 模型列表按 [订阅模型与推理说明](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference) 从 `GET /v1/models` 的 `models` 数组读取 `visibility: list` 条目，使用 `slug` 发送推理。
- 流式推理由 `pi-ai` 的 OpenAI provider 执行。请求显式使用 `store: false`、`stream: true`，发送完整文字历史，遵循订阅接口不支持字段的限制；`pi-ai` 负责锁内刷新过期 token。
- GitHub Pages 与当前 Sites 部署均发布前端静态文件；不运行 Node.js 本机连接服务。使用订阅仍需在用户电脑启动连接服务。
- 公网网站使用服务端回调的商业集成需要对应的 OAuth 客户端、回调注册和订阅调用资格。当前项目采用可本机运行的开源应用流程，不声称已经获得商业网站 OAuth 资格。

开发可分别运行 `npm run dev` 和 `npm run ai:server`。自定义开发网页 Origin 可用 `AI_ALLOWED_ORIGINS`（逗号分隔完整 Origin）添加；`AI_PORT` 可改变本机端口。

## 验证

```powershell
npm run test:ai
npm run build
npm run build:sites
```

自动化覆盖加密保存与恢复、并发写入、JWT 签名/nonce/audience/过期校验、OAuth state 与一次性回调、未授予订阅权限、连接码和来源检查、账号模型列表、真实 `pi-ai` 适配器的模拟流式响应与认证失败、订阅 Responses 请求字段和服务重启后的模型恢复。测试不使用真实账号，也不消耗真实订阅。

发布前在桌面与手机宽度核对地图、美食、城市上下文、配置保存、流式对话、停止、新对话与错误提示。真实账号登录、授权可用性与真实推理仍需用户完成一次端到端验证。助手未接入联网搜索，不能将建议视为实时开放时间、票价或天气信息。
