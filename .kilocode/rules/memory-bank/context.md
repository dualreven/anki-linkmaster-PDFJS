### Bug: Tabulator 双击行触发 isSelected 缺失错误（已修复）

- 报错：js: The row component does not have a isSelected function, have you checked that you have the correct Tabulator module installed?
- 触发时机：在 pdf-home 的 Tabulator 表格上双击行（rowDblClick）时出现
- 修复状态：✅ 已修复
- 修复方案：
  - 在 table-wrapper.js 的 rowFormatter 中移除对 row.isSelected()、row.select()、row.deselect() 的依赖
  - 改用 DOM class（tabulator-selected）与 checkbox 状态维护回退选择态
  - index.js 中 rowDblClick 使用 row.getData()，未调用 isSelected，不需要改动
  - package.json 使用 tabulator-tables@^5.4.4（非模块化 v6），保持不变

### PDF表格双击打开PDF查看器（功能已验证）

**用户需求**：在 pdf-home 的 PDF表格上双击任何一行，使用 pdf-viewer 打开对应的PDF

**当前状态**：✅ 功能已成功实现并验证

**相关模块与文件**：
- `src/frontend/pdf-home/table-wrapper.js`：表格组件（已修复isSelected问题）
- `src/frontend/pdf-home/index.js`：PDFhome应用主文件（第75-90行实现双击事件）
- `src/frontend/common/pdf/pdf-manager.js`：处理OPEN.REQUESTED事件（第160-175行）
- `src/backend/websocket/standard_server.py`：后端处理OPEN_PDF请求（第327-366行）
- `ai-launcher.ps1`：模块启动脚本（支持-PdfPath参数）
- `src/frontend/pdf-viewer/main.js`：PDF查看器自动加载（第625-630行）

**功能链验证结果**：
1. ✅ 前端双击事件：index.js rowDblClick → 获取行数据 → 触发OPEN.REQUESTED事件
2. ✅ PDF管理器：监听OPEN.REQUESTED → 调用openPDF方法
3. ✅ WebSocket通信：发送OPEN_PDF请求到后端
4. ✅ 后端处理：handle_open_pdf_request → 调用ai-launcher.ps1启动pdf-viewer
5. ✅ 参数传递：通过-PdfPath参数和window.PDF_PATH注入
6. ✅ PDF查看器：自动检查window.PDF_PATH并加载对应PDF

**修复的问题**：
- 已修复Tabulator的isSelected错误
- 已禁用alert阻塞问题
- 已验证WebSocket连接正常
- 已验证PDF路径传递正确

**预期结果**：用户可以通过双击表格行来快速打开PDF查看器，查看特定PDF文件