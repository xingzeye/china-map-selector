# 中国地图省份选择器

## 项目介绍
这是一个基于React和ECharts开发的中国地图省份选择器，可以实现随机选择省份的功能，并支持查看省份详细地图。

## 功能特点
- 中国省份地图展示
- 随机选择省份功能（带动画效果）
- 切换显示选中省份的详细地图
- 响应式设计，适配不同屏幕大小

## 技术栈
- React 18
- Vite
- ECharts
- ECharts-for-React

## 使用方法
1. 克隆仓库到本地
2. 安装依赖：`npm install`
3. 启动开发服务器：`npm run dev`
4. 构建生产版本：`npm run build`

## 页面结构
- 顶部：标题和使用说明
- 中部：中国地图和省份详细地图的展示区域
- 底部：随机选择按钮

## 交互说明
- 点击"随机选择省份"按钮，会触发一个动画效果，随机选择一个省份
- 选中省份后，右侧会显示该省份的详细地图
- 点击"使用说明"按钮，可以查看详细的使用方法

## 数据来源
使用阿里云DataV提供的GeoJSON数据：
- 中国地图：https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json
- 省份地图：https://geo.datav.aliyun.com/areas_v3/bound/{省份代码}_full.json

## 项目结构
```
china-map-selector/
├── public/           # 静态资源
├── src/              # 源代码
│   ├── assets/       # 图片等资源
│   ├── App.jsx       # 主组件
│   ├── App.css       # 主样式
│   ├── main.jsx      # 入口文件
│   └── index.css     # 全局样式
├── index.html        # HTML模板
├── package.json      # 项目配置
└── vite.config.js    # Vite配置
```
