# 模块：pdf-home

> 注意：本页描述的是 **早期 pdf-home v1 结构**（table-wrapper/ui-manager 等），当前实现已经重构为以 `core/pdf-home-app-v2.js` + Feature 体系为主的架构。下列文件路径仅作为历史参考，了解旧版实现时可阅读；要了解最新版结构，请优先参考 `src/frontend/pdf-home/README.md` 与 `src/frontend/pdf-home/ARCHITECTURE-REFACTORING-SUMMARY.md`。

简介：pdf-home 页面负责展示 PDF 列表、表格渲染与用户交互。

主要文件（旧版架构）：
- src/frontend/pdf-home/index.js:1
- src/frontend/pdf-home/table-wrapper.js:1
- src/frontend/pdf-home/ui-manager.js:1
- src/frontend/pdf-home/style.css:1

核心职责：
- 渲染 PDF 列表表格（使用 Tabulator）
- 响应本地事件（如 pdf:list:updated）并刷新视图
- 提供添加/删除入口并触发本地事件

重要细节（旧版架构）：
- 表格封装在 table-wrapper.js 中，负责处理列配置与数据绑定
- UIManager 在 ui-manager.js 中，负责从事件总线订阅并更新组件状态

实现参考路径（文件已在新版中被替代，仅作为历史示例）：
- src/frontend/pdf-home/index.js:45（初始化表格与事件订阅）
- src/frontend/pdf-home/table-wrapper.js:120（表格渲染函数）
