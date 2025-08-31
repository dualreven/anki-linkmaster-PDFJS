# table-wrapper 模块 — 细节层

函数与接口：
- createTable(container, columns, options)
  - 参考：src/frontend/pdf-home/table-wrapper.js:30
  - 作用：构造 Tabulator 表格实例并返回 API 对象。
- reloadData(items)
  - 参考：src/frontend/pdf-home/table-wrapper.js:88
  - 作用：将新的数据数组加载到表格并重新渲染。
- getSelected()
  - 参考：src/frontend/pdf-home/table-wrapper.js:150
  - 作用：返回当前选中的行数据。

细节：
- 列定义中包含 id、名称、大小、添加时间，并对 name 列启用单元格格式化。
- 用于与 UI 交互的事件（rowDblClick, rowSelectionChanged）在 createTable 中绑定。

测试：
- 在 pdf-home 页面手动调用 tableWrapper.reloadData([{...}]) 验证表格更新。