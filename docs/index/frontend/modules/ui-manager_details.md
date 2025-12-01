# ui-manager 模块 — 细节层

> 注意：本页细节对应的是旧版 pdf-home v1 中的 UIManager（文件 `src/frontend/pdf-home/ui-manager.js`），当前代码结构中该文件已被移除。以下行号与示例用于回顾历史实现，不应再视为当前实现的真实路径。

函数与接口（旧版）：
- subscribeEvents()
  - 参考：src/frontend/pdf-home/ui-manager.js:78
  - 作用：订阅关键事件（pdf:list:updated, pdf:add:result）并注册回调。
- notify(component, payload)
  - 参考：src/frontend/pdf-home/ui-manager.js:115
  - 作用：将更新下发到具体组件，如刷新表格或更新统计数字。

状态管理：
- 简单本地缓存：保持最近一次 pdf 列表与选择状态以便快速恢复视图。

调试：
- 在 ui-manager 的订阅回调中打印日志以追踪事件流（参考 debug-console-at-9222.log）。
