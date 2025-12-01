# 模块：ui-manager

> 注意：本页描述的 UI Manager 位于旧版 pdf-home v1 架构中，使用 `src/frontend/pdf-home/ui-manager.js`。当前 pdf-home 已重构为基于容器 + Feature 的结构，不再包含该文件；以下内容仅用于回顾历史设计。

简介：UI 管理器负责组件生命周期、事件订阅与状态同步。

主要文件（旧版架构）：
- src/frontend/pdf-home/ui-manager.js:1

职责（旧版）：
- 订阅本地事件并通知视图更新
- 管理组件间通信和简单状态缓存

细节（旧版）：
- 订阅代码见 src/frontend/pdf-home/ui-manager.js:78
- 更新流程见 src/frontend/pdf-home/ui-manager.js:110
