# 项目指南

## 网站目标

中国地图选择器帮助用户通过地图挑选目的地，并通过美食图库随机获得用餐灵感。界面以全国地图为主视觉；省份详情、城市结果和操作区保持清晰的阅读顺序。

## 页面与交互

- **地图页**：加载 `public/china.json` 并注册到 ECharts。点击支持的省份后，从 `public/province-maps/` 读取对应 GeoJSON，显示省级地图及内置的主要城市选项。
- **随机与轮播**：随机城市选择约 5 秒，会在地图上高亮对应省份；轮播逐个预览省份。停止轮播保留当前结果，重新选择则清空状态。
- **美食页**：读取 `public/food_data.json`，展示 24 张可爱手绘风 WebP 图片卡片，并提供约 4 秒的随机选择与结果展示；随机过程可停止。

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
```

默认构建用于 GitHub Pages，资源路径以 `/china-map-selector/` 开头；`build:sites` 用于站点根路径，资源路径以 `/` 开头。两者都输出到 `dist/`，依次执行时仅保留最后一次构建结果。检查桌面与手机宽度下的地图完整性、选省/城市、随机与轮播、美食结果，并核对相应构建的地图数据、美食图片和图标路径。`npm run lint` 脚本已存在，但仓库当前没有 ESLint 配置，不能将其运行失败视为代码已经过静态检查。

部署细节见 [DEPLOY.md](./DEPLOY.md)。
