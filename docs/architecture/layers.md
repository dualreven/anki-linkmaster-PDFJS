# 分层模型与 Feature / EventBus（索引版）

分层与边界
- 前端：纯 UI；通过共享基础设施（EventBus/Logger/WSClient）协作；必要时用 QWebChannel 桥接本地能力
- 后端：WS 转发器 / HTTP 文件服务器 / PDF 业务服务器（预留）

Feature 与注册
- FeatureRegistry：负责注册、依赖解析、拓扑安装与上下文（容器/Logger/ScopedEventBus）创建
- 别名（alias）：支持旧名→规范名映射，确保依赖拓扑稳定

事件与作用域
- ScopedEventBus：以 `Feature.SCOPE_ID` 稳定命名空间（即便后续重命名）
- 跨模块通信统一用 `onGlobal/emitGlobal`；避免 scoped ↔ global 不一致

命名与 IO
- 目录 kebab-case；读写显式 UTF-8 + `\n`

参考
- 事件规范：docs/standards/events.md
- 质量门禁：docs/quality/quality-gates.md
