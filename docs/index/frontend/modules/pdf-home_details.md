# pdf-home 模块 — 细节层

函数与接口：
- initTable(config)
  - 位置参考：src/frontend/pdf-home/index.js:45
  - 作用：初始化 Tabulator 表格、绑定列与事件（双击/选择）。
- onPdfListUpdated(payload)
  - 位置参考：src/frontend/pdf-home/index.js:72
  - 作用：处理 pdf:list:updated 事件，调用 tableWrapper.reloadData(payload.items) 并更新本地计数。
- handleAdd()
  - 位置参考：src/frontend/pdf-home/index.js:110
  - 作用：打开文件选择或触发上传流程，构建 request_id 并通过事件总线发布添加消息。
- handleDelete(selectedIds)
  - 位置参考：src/frontend/pdf-home/index.js:140
  - 作用：确认删除、构建删除消息（包含 request_id 与 metadata）并发布到事件总线。

数据结构示例：
- PDF 元数据格式（示例）：
  {
    "id": "uuid",
    "name": "filename.pdf",
    "size": 12345,
    "added_at": "2025-08-31T...",
    "source": "local"
  }

关键调用：
- tableWrapper.reloadData(data) — src/frontend/pdf-home/table-wrapper.js:88
- 事件发布：EventBus.publish('pdf:add', {request_id, items}) — kilocode/system-prompt-agent-master.yaml:10

测试与观察：
- 在调试控制台观察 pdf-home 页面日志（debug-console-at-9222.log）。
