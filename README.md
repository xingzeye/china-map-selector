# 中国地图选择器 (China Map Selector)

一个基于 React、Vite 和 ECharts 的交互式网站：在中国地图上选择省份、查看省级地图和主要城市，也可以从美食图库中随机挑选。

在线地址：[xingzeye.github.io/china-map-selector](https://xingzeye.github.io/china-map-selector/)

Sites 站点：[山海之间](https://china-map-selector.xzy666999.chatgpt.site)

## 功能

- 🗺️ 展示中国地图，点击省份查看对应的省级地图。
- 📍 从内置的主要城市列表中选择城市，或随机选择目的地。
- 🎲 支持省份轮播与约 5 秒的随机城市选择；轮播可停在当前结果，也可重新清空。
- 🍜 浏览 24 张可爱手绘风美食卡片，并进行约 4 秒的随机挑选；过程可随时停止。
- 📱 以地图为主视觉，适配桌面和移动屏幕。
- ✦ AI 旅行助手：自动带入已选城市与美食灵感，支持景点、美食、行程规划和多轮聊天；流式输出可停止、复制、导出或清空。
- ⚙ 页面模型配置：优先支持 ChatGPT Plus / Pro 订阅的本机 OAuth 连接，同时支持 API Key、自定义接口和 Coding Plan 配置。

地图的立体感采用 ECharts 的渐变、分层阴影和高亮效果；这是二维地图的视觉层次，并非真实地形高度。

## 本地运行

需要 Node.js 22.19.0 或更新版本和 npm。在项目根目录执行：

```bash
npm ci
npm run dev
```

生产构建与本地预览：

```bash
npm run build
npm run preview
```

使用 ChatGPT 订阅时另开终端运行 `npm run ai:server`，打开 `http://127.0.0.1:8787/connect` 复制连接码，然后在网页 **模型配置 → ChatGPT 订阅** 中连接和授权。完整步骤、保存位置和部署边界见 [AI_SETUP.md](./AI_SETUP.md)。自动化验证运行 `npm run test:ai`。

部署到 Sites 根路径时使用 `npm run build:sites`。两种构建都会输出到 `dist/`，后一次更新 HTML 与对应资源引用；遵循不批量删除的约定，构建不会自动清空已有历史资源。本项目是应用仓库，`package.json` 标记为 `private`，无需执行 `npm install china-map-selector`。

## 使用方式

1. 在地图页点击省份，查看该省的详细地图和可选的主要城市。
2. 使用随机选择或轮播探索目的地；“停止轮播”保留当前结果，“重新选择”返回初始状态。
3. 切换到美食页，浏览卡片或随机选择一种美食。
4. 在页面配置模型后打开 AI 旅行助手；选择城市后可直接问景点、美食或规划三天两夜。回答支持复制，整段对话可导出为 Markdown。

对话和非秘密设置只保存在当前浏览器，API Key 与连接码仅在标签页会话保留。订阅凭据在 `.ai-local/` 加密保存并被 Git 忽略。公开网页上的每位使用者连接自己的模型或本机订阅服务；静态部署不会自动运行 Node 后端。助手没有实时联网搜索，门票、预约、营业时间等需向官方核实。

城市列表为项目内置的部分主要城市，不代表完整行政区划。省级详情数据覆盖项目内置的 31 个省级区域；全国地图还绘有港澳台，但当前没有相应的省级详情页。

## 技术与数据

- React 18、Vite 5、ECharts 5、echarts-for-react 3。
- `@earendil-works/pi-ai` 统一模型与流式事件，`react-markdown` / `remark-gfm` 渲染回答，`jose` 验证 ChatGPT OAuth 身份 token。
- `public/china.json` 与 `public/province-maps/` 保存本地 GeoJSON，避免运行时依赖外部地图接口。
- `public/food_data.json` 保存美食条目，`public/food-images/food-art-v2/` 保存 24 张网页使用的 WebP 手绘图。旧 SVG 素材仍保留，但美食卡片不再引用。
- 未压缩的手绘 PNG 原图保存在本地 `.art-source/food-art-v2/`（已忽略，不进入网页构建）；网页图片总量约 1.8 MB，卡片按需加载。
- 地图数据由阿里云 DataV GeoJSON 接口获取，下载脚本位于 `scripts/`。

## 项目结构

```text
china-map-selector/
├── public/                 # 地图、美食数据与图片
├── scripts/                # 地图数据下载脚本
├── server/                 # 本机订阅连接、OAuth 与加密凭据存储
├── tests/ai.test.mjs        # AI 接入自动化验证
├── src/
│   ├── ai/                 # 模型目录、旅行上下文与客户端
│   ├── components/         # AI 聊天和模型配置界面
│   ├── App.jsx             # 页面状态、地图配置与交互
│   ├── App.css             # 页面与响应式样式
│   ├── index.css           # 全局样式
│   └── main.jsx            # React 入口
├── PROJECT_GUIDE.md        # 功能与界面设计说明
├── AGENT.md                # 修改约定与验证方式
├── AI_SETUP.md             # 模型及 ChatGPT 订阅接入步骤
├── index.html
└── vite.config.js
```

## 部署

默认 `npm run build` 使用 `/china-map-selector/` 基础路径，可使用 `npm run deploy` 构建并发布到 GitHub Pages 的 `gh-pages` 分支。部署到站点根路径时运行 `npm run build:sites`，将生成的 `dist/` 用于 Sites。地图数据、菜品数据、图片和网站图标均随构建基础路径解析。仓库内还保留了 GitHub Actions Pages 工作流，但它当前监听 `main`，而现用分支为 `master`；若要通过该工作流自动发布，需要先统一分支与 Pages 配置。更多步骤见 [DEPLOY.md](./DEPLOY.md)。
