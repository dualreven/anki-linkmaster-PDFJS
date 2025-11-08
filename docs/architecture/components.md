# 关键组件（索引版）

WebSocket 转发器（headless）
- 职责：消息接入/校验/路由；不包含 UI
- 依赖：后端消息类型枚举与路由表

HTTP 文件服务器
- 职责：PDF 与静态资源的只读传输（支持 Range）
- 组件：请求解析、响应写入、流式发送、MIME/路径解析

PDF 业务服务器（预留）
- 职责：执行业务逻辑（如 Outline/Annotation/Anchor 等），返回契约化响应

参考
- 契约：docs/contracts/ws-outline.md
- 构建运行：docs/engineering/build-run.md
