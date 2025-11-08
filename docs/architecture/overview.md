# 架构总览与组件（索引版）

目标：快速理解本系统的高层结构与关键组件职责。

高层结构
- 前端：pdf-home、pdf-viewer（纯 UI），共享基础设施（EventBus、Logger、WSClient、QWebChannel 适配）
- 后端：三部分
  - WebSocket 转发器（headless）：消息接入与路由
  - HTTP 文件服务器：PDF/静态资源的只读传输（支持 Range）
  - PDF 业务服务器（预留）：执行业务逻辑并返回契约化响应

启动与运行
- 源码模式：Vite/Hosted is_prod=false
- 分发模式：静态路由 `/static`、`/pdf-home`、`/pdf-viewer`
- 统一日志：UTF-8 结构化日志；错误带 trace/actorId/request_id

参考
- 分层模型：docs/architecture/layers.md
- 构建运行：docs/engineering/build-run.md
