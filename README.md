# 中国地图选择器

一个基于React和ECharts的中国地图选择器组件，支持省份选择和下钻到具体城市，提供流畅的地图交互体验。

## 🌟 特性

- 完整的中国地图可视化展示
- 支持省份选择和城市下钻功能
- 实时显示选中区域的地理信息
- 流畅的动画过渡效果
- 响应式设计，适配多种屏幕尺寸

## 🛠 技术栈

- React 18
- Vite 4.x
- ECharts 5.x
- ECharts-for-React 3.x

## 📦 安装

1. 克隆项目到本地：
```bash
git clone https://github.com/[your-username]/china-map-selector.git
cd china-map-selector
```

2. 安装依赖：
```bash
npm install
```

3. 启动开发服务器：
```bash
npm run dev
```

4. 构建生产版本：
```bash
npm run build
```

## 🎯 使用方法

1. 在首页可以看到完整的中国地图
2. 点击任意省份可以查看该省份的详细地图
3. 使用顶部的返回按钮可以回到全国地图视图

## 🔍 主要功能

- **省份选择**：点击任意省份可以进入该省份的地图视图
- **地理信息展示**：实时显示当前选中区域的名称和相关信息
- **交互反馈**：提供清晰的视觉反馈，包括悬停效果和选中状态

## 📊 数据来源

本项目使用阿里云DataV提供的GeoJSON数据：
- 全国地图：https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json
- 省份地图：https://geo.datav.aliyun.com/areas_v3/bound/{行政区划代码}_full.json

## 📁 项目结构

```
china-map-selector/
├── public/                 # 静态资源
├── src/                    # 源代码
│   ├── assets/            # 资源文件
│   ├── App.jsx            # 主应用组件
│   ├── App.css            # 主应用样式
│   ├── main.jsx           # 入口文件
│   └── index.css          # 全局样式
├── index.html             # HTML模板
├── package.json           # 项目配置
└── vite.config.js         # Vite配置
```

## 🚀 部署

本项目支持部署到GitHub Pages，详细部署步骤请参考 [DEPLOY.md](./DEPLOY.md) 文件。

## 📄 许可证

[MIT License](LICENSE)
