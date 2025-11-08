# 架构索引（Architecture README）

目的：作为架构专题的统一入口与导航，便于快速查阅各主题文档。

快速导航
- 总览与组件：docs/architecture/overview.md
- 分层模型与 Feature/Bus：docs/architecture/layers.md
- 导航与互斥策略：docs/architecture/navigation.md
- 设计原则（Fail‑Fast 等）：docs/architecture/principles.md
- 关键组件（WS/HTTP/PDF 服务）：docs/architecture/components.md
- 数据库系统：docs/architecture/database.md
- 加密与消息中心：docs/architecture/security-messaging.md
- 构建与运行：docs/engineering/build-run.md

文本示意图
```
[Frontends]
  pdf-home      pdf-viewer
      \        /
       \      /
      [EventBus + Logger + WSClient]
               |
         (WS / QWebChannel)
               |
     +----------------------------+
     |        MsgCenter          |
     | (type whitelist, router)  |
     +----------------------------+
        |            |            \
   [HTTP Server]  [DB Plugins]   [PDF Business (future)]
     (static)      (outline/...)      (domain handlers)
```

约定与检查
- 事件/消息：遵循 docs/standards/events.md；前后端类型集合通过 CI 比对
- 质量门禁：见 docs/quality/quality-gates.md；提交/上线前自检见 docs/checklists/self-check.md

维护记录
- 2025-11-07 新增本索引页，收束架构导航与约定入口

