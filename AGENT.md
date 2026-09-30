# 开发约定

- 修改网站代码时，同步核对并更新根目录的 `README.md`、`PROJECT_GUIDE.md` 和本文件，让功能、设计与验证说明保持一致。
- 保留已有用户改动；开始前检查 `git status` 和相关文件差异。
- 不批量删除文件或目录。需要删除时，一次仅处理一个明确文件路径；批量删除应交由用户手动完成。
- 地图边界以本地 GeoJSON 为准。立体感只用于视觉层次，避免误导为真实地形数据。
- 保持地图交互、随机选择、美食页以及 GitHub Pages `/china-map-selector/` 和 Sites 根路径两种构建正常。公共资源应通过 `import.meta.env.BASE_URL` 解析，避免写死部署路径。新增视觉效果应兼顾手机宽度、键盘操作与减少动态效果的偏好。
- 轮播停止需保留当前结果，重新选择需清空状态；省级地图请求失败时不要显示其他省份的旧地图。
- 美食卡片使用 `food_data.json` 引用的手绘风 WebP 栅格图；新增或更换菜品图时保持可爱手绘风格，并核对卡片、当前选择和结果弹窗的图片路径，不恢复 SVG 引用。
- 完成代码修改后至少运行 `npm run build`；涉及部署路径时还要运行 `npm run build:sites`，并在浏览器核对地图、选择流程与窄屏布局。两种构建共用 `dist/`，后一次会覆盖前一次。不要把未实际运行的检查写成已通过。
- AI 接入使用 `@earendil-works/pi-ai` 的 Models/Provider 与流式事件；保留城市上下文、停止/错误处理、Markdown 渲染和多轮对话。接口与模型值必须由用户配置或账号真实模型列表得到，不把内置目录当作权限证明。
- 默认 ChatGPT 订阅采用单用户本机 OAuth 服务。维持 loopback 监听、连接码、Origin/Host 检查、PKCE/state/nonce/JWKS 验证与订阅 scope 检查；不把它直接改为公网共享账号服务。
- `.ai-local/` 包含本机凭据与加密密钥，必须保持忽略，不得提交、日志输出或部署。API Key/连接码仅在浏览器 sessionStorage 中保存，非秘密设置与本机对话才使用 localStorage。
- 涉及 AI 时运行 `npm run test:ai`；用模拟响应验证流式、错误、取消、模型目录与授权校验，并核对手机布局。未实际完成用户账号 OAuth/推理时明确标记未验证，不能把模拟测试称为真实订阅已接通。
- 同步 GitHub 与现有 Sites 时沿用 `.openai/hosting.json` 的 project_id 和当前访问范围，先验证再发布。说明静态页面与本机订阅服务的边界，更新 `AI_SETUP.md`。
- Vite 使用 `emptyOutDir: false`，构建前不批量清空 `dist/`。发布 GitHub Pages 时可在独立 checkout 覆盖新增产物并提交，保留旧文件；不要运行删除分支文件或缓存目录的批量清理命令。
