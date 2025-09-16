### PDF Viewer 上下内容被遮挡修复（当前目标）

**用户问题**：在 pdf-viewer 展示 PDF 页面时，最顶部和最底部约 10px 被遮挡，需要设置合适的 margin/padding 避免遮挡。

**问题背景**：
- 布局结构：header 在顶部，main 为相对定位且 overflow:hidden，.pdf-container 在 main 内部，承担滚动，overflow:auto；canvas 在 .pdf-container 中居中显示。
- 由于 .pdf-container 紧贴 main 的上/下边界，canvas 与容器边缘/滚动条接触，视觉上呈现顶部/底部被裁切约 10px。

**相关模块与文件**：
- 前端样式：src/frontend/pdf-viewer/style.css
- 前端结构：src/frontend/pdf-viewer/index.html
- 相关渲染：src/frontend/pdf-viewer/ui-manager.js（未改动），main.js（未改动）

**解决方案（最小侵入）**：
- 为 .pdf-container 增加上下安全内边距，避免 canvas 紧贴容器边缘：
  - padding-top: 16px;
  - padding-bottom: 16px;

**执行步骤**：
1. 定位样式文件 style.css 中的 .pdf-container 规则。
2. 添加 padding-top/bottom 16px。
3. 不修改 JS 逻辑与事件系统，保持缩放/导航功能不受影响。
4. 记录工作日志。

**已执行结果**：
- 已修改 src/frontend/pdf-viewer/style.css，为 .pdf-container 添加：
  - padding-top: 16px;
  - padding-bottom: 16px;
- 预期效果：PDF 页面在任意缩放下，上下不再被裁切；滚动时保留安全留白。

**后续建议**：
- 如需适配刘海/安全区，可将 16px 抽为 CSS 变量（例如 --viewer-safe-padding）并按环境覆盖。