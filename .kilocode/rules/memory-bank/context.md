### PDF表格双击打开PDF查看器（当前目标）

**用户需求**：在 pdf-home 的 PDF表格上双击任何一行，使用 pdf-viewer 打开对应的PDF

**问题背景**：
- pdf-home 使用 Tabulator Tables 显示 PDF 文件列表
- 需要添加双击事件处理，获取行数据（PDF ID）
- 需通过系统调用或后端切换到 pdf-viewer 模块并加载指定PDF
- 保证现有 PDF 管理功能不受影响

**相关模块与文件**：
- `src/frontend/pdf-home/table-wrapper.js`：表格组件
- `src/frontend/pdf-home/index.js`：PDFhome应用主文件
- `ai-launcher.ps1`：模块启动脚本
- `src/backend/app/application.py`：后端应用管理

**解决方案**：
- 在 Tabulator 配置中添加 rowDblClick 回调
- 从双击行获取 PDF ID 和文件名
- 通过执行 ai-launcher.ps1 启动 pdf-viewer 并传递 PDF 参数
- 使用 async/await 保证非阻塞用户体验

**执行步骤**：
1. 分析 Tabulator 表格配置，确定如何添加双击事件
2. 实现双击回调函数，提取 PDF 数据
3. 添加启动 pdf-viewer 的逻辑（可能需要 new_task 或直接执行脚本）
4. 测试双击功能，确保打开正确 PDF
5. 更新 context.md 和记录工作日志

**已执行结果**：
- 正在分析表格实现
- 准备添加事件监听器

**预期结果**：用户可以通过双击表格行来快速打开PDF查看器，查看特定PDF文件