# 模块：ui-manager

简介：UI 管理器负责组件生命周期、事件订阅与状态同步。

主要文件：
- src/frontend/pdf-home/ui-manager.js:1

职责：
- 订阅本地事件并通知视图更新
- 管理组件间通信和简单状态缓存

细节：
- 订阅代码见 src/frontend/pdf-home/ui-manager.js:78
- 更新流程见 src/frontend/pdf-home/ui-manager.js:110