# 模块：pdf-home

简介：pdf-home 页面负责展示 PDF 列表、表格渲染与用户交互。

主要文件：
- src/frontend/pdf-home/index.js:1
- src/frontend/pdf-home/table-wrapper.js:1
- src/frontend/pdf-home/ui-manager.js:1
- src/frontend/pdf-home/style.css:1

核心职责：
- 渲染 PDF 列表表格（使用 Tabulator）
- 响应本地事件（如 pdf:list:updated）并刷新视图
- 提供添加/删除入口并触发本地事件

重要细节：
- 表格封装在 table-wrapper.js 中，负责处理列配置与数据绑定
- UIManager 在 ui-manager.js 中，负责从事件总线订阅并更新组件状态

实现参考路径：
- src/frontend/pdf-home/index.js:45（初始化表格与事件订阅）
- src/frontend/pdf-home/table-wrapper.js:120（表格渲染函数）