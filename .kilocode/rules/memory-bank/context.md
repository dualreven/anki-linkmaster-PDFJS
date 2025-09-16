
### Bug: Tabulator 双击行触发 isSelected 缺失错误（进行中）

- 报错：js: The row component does not have a isSelected function, have you checked that you have the correct Tabulator module installed?
- 触发时机：在 pdf-home 的 Tabulator 表格上双击行（rowDblClick）时出现
- 初步判断：
  - 可能未启用 Select Rows 模块（未导入/注册，或未用 TabulatorFull）
  - 或在 rowDblClick 中错误调用 row.isSelected()（在未启用选择功能场景）
- 相关文件：
  - src/frontend/pdf-home/table-wrapper.js（表格封装与事件绑定）
  - src/frontend/pdf-home/index.js（应用主文件，曾在约第73-81行实现双击）
  - package.json（Tabulator 版本与引入方式）
- 修复策略（二选一）：
  1) 使用 Tabulator Full 构建以避免模块遗漏：
     - import { TabulatorFull as Tabulator } from 'tabulator-tables';
     - 表格需要选择功能时，配置 selectable: true
  2) 使用模块化包时显式注册选择模块：
     - import Tabulator from '@tabulator-tables/core';
     - import SelectRowsModule from '@tabulator-tables/select-rows';
     - Tabulator.registerModule([SelectRowsModule]);
     - 并配置 selectable: true
  - 若业务不依赖选中状态：删除 row.isSelected() 调用，仅使用 row.getData() 读取业务字段（pdfId、filePath），保持双击打开逻辑。

执行步骤（原子化）：
1. 检查 package.json 中 Tabulator 引入（tabulator-tables 或 @tabulator-tables/*）与版本
2. 静态检查 src/frontend/pdf-home/table-wrapper.js 与 index.js 中的 rowDblClick 实现，确认是否调用 row.isSelected()
3. 若存在 isSelected 调用且未启用选择模块：
   - 优先切换为 TabulatorFull 导入；或注册 SelectRows 模块
   - 表格配置加入 selectable: true（确需选择时）
4. 若业务不需要选中状态：移除 isSelected 调用，改用 row.getData()
5. 保存修改，更新日志与本文件状态
6. 回归测试：双击行是否正常打开 PDF，无错误日志
### PDF表格双击打开PDF查看器（已完成）

**用户需求**：在 pdf-home 的 PDF表格上双击任何一行，使用 pdf-viewer 打开对应的PDF

**问题背景**：
- pdf-home 使用 Tabulator Tables 显示 PDF 文件列表
- 需要添加双击事件处理，获取行数据（PDF ID）
- 需通过系统调用或后端切换到 pdf-viewer 模块并加载指定PDF
- 保证现有 PDF 管理功能不受影响

**相关模块与文件**：
- `src/frontend/pdf-home/table-wrapper.js`：表格组件
- `src/frontend/pdf-home/index.js`：PDFhome应用主文件（第73-81行实现双击事件）
- `src/frontend/common/pdf/pdf-manager.js`：处理OPEN.REQUESTED事件（第160-175行）
- `src/backend/websocket/standard_server.py`：后端处理OPEN_PDF请求（第327-366行）
- `ai-launcher.ps1`：模块启动脚本（支持-PdfPath参数）
- `src/frontend/pdf-viewer/main.js`：PDF查看器自动加载（第625-630行）

**解决方案**：
- 在 Tabulator 配置中添加 rowDblClick 回调
- 从双击行获取 PDF ID 和文件名
- 通过执行 ai-launcher.ps1 启动 pdf-viewer 并传递 PDF 参数
- 使用 async/await 保证非阻塞用户体验

**执行结果**：
- ✅ 双击功能已实现：用户可以通过双击表格行来快速打开PDF查看器
- ✅ 完整功能链：前端双击 → WebSocket消息 → 后端处理 → 启动pdf-viewer → 自动加载PDF
- ✅ 非阻塞体验：使用 subprocess.Popen 避免阻塞WebSocket服务器
- ✅ 参数传递：通过 --file-path 和 window.PDF_PATH 实现PDF路径传递

**预期结果**：用户可以通过双击表格行来快速打开PDF查看器，查看特定PDF文件
- 进展更新（2025-09-16 14:47 CST）：
  - 已在 src/frontend/pdf-home/table-wrapper.js 的 rowFormatter 中移除对 row.isSelected()、row.select()、row.deselect() 的依赖，改用 DOM class（tabulator-selected）与 checkbox 状态维护回退选择态，避免在未启用 Select Rows 模块时触发错误。
  - index.js 中 rowDblClick 使用 row.getData()，未调用 isSelected，不需要改动。
  - package.json 当前使用 tabulator-tables@^5.4.4（非模块化 v6），保持不变以实现最小侵入修复。
  - 待回归测试：双击行打开 PDF 时不再出现 isSelected 缺失错误；选择相关的 UI 行为在回退机制下正常。