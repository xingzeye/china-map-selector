# 部署到GitHub Pages指南

本文档提供了如何将中国地图选择器应用部署到GitHub Pages的详细步骤。

## 前提条件

- 已有GitHub账号
- 已安装Git
- 已安装Node.js和npm

## 部署步骤

### 1. 创建GitHub仓库

1. 登录GitHub账号
2. 点击右上角的"+"按钮，选择"New repository"
3. 填写仓库名称，例如"china-map-selector"
4. 选择公开(Public)仓库
5. 点击"Create repository"

### 2. 初始化本地Git仓库并推送到GitHub

```bash
# 在项目根目录下初始化Git仓库
git init

# 添加所有文件到暂存区
git add .

# 提交更改
git commit -m "初始提交"

# 添加远程仓库
git remote add origin https://github.com/你的用户名/china-map-selector.git

# 推送到GitHub
git push -u origin main
```

### 3. 使用gh-pages部署

项目已配置好gh-pages部署脚本，你可以直接运行以下命令进行部署：

```bash
npm run deploy
```

这将自动构建项目并将构建结果推送到GitHub仓库的gh-pages分支。

### 4. 配置GitHub Pages

1. 在GitHub仓库页面，点击"Settings"
2. 在左侧菜单中找到"Pages"
3. 在"Source"部分，选择"Deploy from a branch"
4. 在"Branch"下拉菜单中选择"gh-pages"分支，然后点击"Save"
5. 等待几分钟后，你的应用将会部署到类似 https://你的用户名.github.io/china-map-selector 的URL

## 自动部署

本项目已配置GitHub Actions工作流，每当你推送代码到main分支时，应用将自动部署到GitHub Pages。

工作流配置文件位于 `.github/workflows/deploy.yml`。

## 注意事项

- 确保vite.config.js中的base配置正确（已设置为"./"）
- 如果你的仓库名称不是"china-map-selector"，请相应地调整部署URL
- 首次部署可能需要几分钟才能生效