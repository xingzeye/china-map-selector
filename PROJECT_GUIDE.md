# 项目指南

## 网站目标

中国地图选择器帮助用户通过地图挑选目的地，并通过美食图库随机获得用餐灵感。界面以全国地图为主视觉；省份详情、城市结果和操作区保持清晰的阅读顺序。

## 页面与交互

- **地图页**：加载 `public/china.json` 并注册到 ECharts。点击支持的省份后，从 `public/province-maps/` 读取对应 GeoJSON，显示省级地图及内置的主要城市选项。
- **随机与轮播**：随机城市选择约 5 秒，会在地图上高亮对应省份；轮播逐个预览省份。停止轮播保留当前结果，重新选择则清空状态。
- **美食页**：读取 `public/food_data.json`，展示 24 张可爱手绘风 WebP 图片卡片，并提供约 4 秒的随机选择与结果展示；随机过程可停止。
- **AI 旅行助手**：地图选定或随机确定的城市与当前美食自动作为旅行上下文。支持自由聊天、快捷询问景点/特色美食、三天两夜行程与对话总结；可停止生成、复制、导出 Markdown、新对话清空记录。
- **模型配置**：全局入口打开原生 dialog。默认 ChatGPT Plus / Pro 订阅模式，通过本机 Node 连接服务完成 OAuth；账号授权后获取真实可选模型。API Key 模式提供多服务商与自定义协议/接口设置。

AI 接入基于 `@earendil-works/pi-ai`，需要 Node.js 22.19.0+。本机连接服务通过 `npm run ai:server` 启动，默认监听 `127.0.0.1:8787`。完整使用、数据保存与接入边界见 [AI_SETUP.md](./AI_SETUP.md)。GitHub Pages 和当前 Sites 发布前端；ChatGPT 订阅需要用户保持本机连接服务运行。API Key 模式要求服务商支持浏览器 CORS。

全国地图数据绘有港澳台。当前省级详情和内置城市列表覆盖 31 个省级区域及其中的部分主要城市，不能把城市列表描述为完整地级市数据。

## 界面方案

- 使用响应式的地图优先布局：全国地图始终是主视觉，操作和省份详情放在侧栏；窄屏时依次向下排列。
- 使用一致的标题、卡片、按钮、选中态和加载态，避免固定高度让内容在手机上被裁切。
- 省级地图加载失败时提供错误提示和重试，避免错误地显示前一个省份的地图。
- 中国地图与省级地图保留准确的 GeoJSON 边界。用 ECharts 渐变、浅层错位阴影与选中高亮营造轻度 2.5D 立体感，不表达真实海拔。
- 美食卡片按可用宽度换列，图片采用完整可辨的手绘菜品构图、短描述与清晰选中态；保留键盘操作，卡片图片按需加载。
- 美食卡片、侧栏选中图和结果弹窗统一引用 `food_data.json` 中的 WebP 栅格图，不再使用 SVG；旧 SVG 文件仅作为未引用的历史素材保留。

## 文件与资源

| 路径 | 用途 |
| --- | --- |
| `src/App.jsx` | 页面状态、选择逻辑、ECharts 地图配置 |
| `src/App.css` | 布局、组件视觉与响应式规则 |
| `src/index.css` | 全局字体与基础样式 |
| `src/components/TravelAssistant.jsx`、`TravelAssistant.css` | AI 聊天、模型配置、响应式对话界面 |
| `src/ai/catalog.js`、`client.js` | 服务商预设、旅行上下文、pi-ai 流式客户端 |
| `server/ai-server.mjs` | 受连接码与来源限制的本机订阅服务 |
| `server/chatgpt-oauth.mjs`、`credential-store.mjs` | PKCE/JWKS 身份校验、加密凭据与重启恢复 |
| `tests/ai.test.mjs`、`AI_SETUP.md` | 接入测试、用户配置与部署说明 |
| `public/china.json` | 全国 GeoJSON |
| `public/province-maps/` | 省级 GeoJSON |
| `public/food_data.json`、`public/food-images/food-art-v2/` | 美食数据与 24 张 WebP 手绘图 |
| `.art-source/food-art-v2/` | 本地未压缩 PNG 原图，已忽略，不参与构建 |
| `vite.config.js`、`package.json` | Vite 构建与 GitHub Pages / Sites 基础路径脚本 |

## 开发与验证

```bash
npm ci
npm run dev
npm run build
npm run build:sites
npm run preview
npm run ai:server
npm run test:ai
```

AI 改动需要运行接入测试，并核对无配置引导、配置保存、目的地切换、多轮/流式回答、停止生成、错误提示、导出与新对话。自动化使用模拟 OAuth/API 响应，不代表真实 ChatGPT 账号已经授权；实际订阅登录和推理需用用户账号完成验证。非秘密配置和最近 60 条对话保存在 localStorage，API Key/连接码放 sessionStorage，ChatGPT token 留在本机 `.ai-local/` 加密文件中。不要把该目录加入版本或部署包。

默认构建用于 GitHub Pages，资源路径以 `/china-map-selector/` 开头；`build:sites` 用于站点根路径，资源路径以 `/` 开头。两者都输出到 `dist/`，后一次更新 HTML 与对应资源引用。`emptyOutDir: false` 禁止构建前批量清空已有文件，因此可能保留历史 hash 资源；不要自行批量清理。检查桌面与手机宽度下的地图完整性、选省/城市、随机与轮播、美食结果，并核对相应构建的地图数据、美食图片和图标路径。`npm run lint` 脚本已存在，但仓库当前没有 ESLint 配置，不能将其运行失败视为代码已经过静态检查。

部署细节见 [DEPLOY.md](./DEPLOY.md)。

Sites 打包使用 `scripts/package-site-safe.mjs`，只复制构建输出、写入站点清单、创建与验证 tar 包，不批量清理目录。`scripts/sites-workflow-safe.mjs` 在保持 Sites 原始检查/提交/推送流程的同时替换会清理临时目录的默认打包器；临时目录保留。
