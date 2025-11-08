# 加密与消息中心（Security & Messaging，索引版）

目标
- 明确“消息中心（MsgCenter）”的结构化消息协议、错误处理框架与安全控制点；
- 覆盖两类通道：WebSocket（WS）与 QWebChannel（QWC，本地 IPC）；
- 给出开发/生产加固建议与 CI/运行期校验清单。

适用范围
- 前端（pdf-home、pdf-viewer）↔ 后端（WS 转发器/业务服务）
- 仅讨论“控制面”消息；PDF/静态文件走 HTTP 文件服务器（见 docs/engineering/build-run.md）

一、消息协议（Envelope）
- 事件名：三段式 `{module}:{action}:{status}`，严格字面（详见 docs/standards/events.md）
- 标准字段：
  - `type: string` 三段式消息类型
  - `request_id: string` 关联请求与回应（UUID/雪花均可）
  - `metadata: object` 版本、来源、actorId、trace_id、ts 等
  - `data: object` 业务负载（遵循各域契约）
  - `error?: { code: string, message: string, details?: any }` 失败通道携带
- 方向：
  - 请求：`*:requested`
  - 完成：`*:completed`（或 `*:success`）
  - 失败：`*:failed`
- 能力发现：`capability:{discover|describe}:{requested|completed}` 返回受支持的消息类型与示例

二、消息中心（MsgCenter）职责
- 类型白名单：仅接受在枚举/路由表中登记的 `type`（见后端 `MessageType` 与 `msg_router.py`）
- 路由与适配：将请求分发至具体 handler；将 handler 返回包装为标准回应
- 相关性与追踪：透传 `request_id/trace_id`；记录调用链（前端可用 MessageTracer）
- 超时与背压：每条请求设置超时；批量/高频操作需限流；连接级背压与缓冲上限
- 尺寸限制：单消息最大字节数、对象深度与数组长度限制；超限直接 `*:failed`

三、通道与加密
- QWebChannel（本地 IPC）
  - 信任边界：仅限本机宿主进程与嵌入的页面（QWebEngine）
  - 建议：保持最小暴露面（只导出必要槽函数）；对输入做严格验证；限制可执行操作
  - 加密：通常不再二次加密（同进程/本机 IPC），但需最小权限原则与白名单路径
- WebSocket（网络/环回）
  - 开发：本机环回（127.0.0.1/::1）可使用明文 `ws://`，但建议端口绑定到回环并加来源校验
  - 生产：强制 `wss://`（TLS）；证书/私钥需独立目录与权限；支持证书轮换与链路健康检查
  - 来源与 CORS：限定 Origin；路径前缀与 Host 校验；禁止通配
  - 鉴权（按需）：令牌/会话绑定；请求头或首次握手完成后升级

四、输入验证与契约校验
- 模式：Schema 校验（JSON Schema/自定义校验器）+ 轻量静态规则（键名/必填/类型/范围）
- 位置：网关层初检（快速失败）→ handler 二次校验（领域语义）
- CI：契约集合比对脚本（已提供 `scripts/ci/ws-contract-diff.mjs`）

五、错误处理框架（统一失败通道）
- 失败统一采用 `*:failed`，携带：
  - `error.code`: UPPER_SNAKE（如 OUTLINE_NOT_FOUND、VALIDATION_ERROR、TIMEOUT）
  - `error.message`: 人类可读，指向具体问题
  - `error.details`: 可选上下文（字段路径、期望/实际值）
- 前端处理：
  - 将失败映射为用户可理解提示（toast），同时写结构化日志
  - 关键路径失败触发自动补救（例如 outline 变更后强制 list 重拉）
- 后端处理：
  - 语义清晰的错误码枚举；避免抛堆栈给前端；敏感信息脱敏

六、日志与审计
- 结构化日志：时间、级别、模块、type、request_id、trace_id、耗时、结果（ok/failed）
- 脱敏：默认对路径、token、cookie 等做脱敏；支持采样
- 追踪：端到端 trace_id；在前端 EventBus/MessageTracer 中串联

七、防护与运行时开关
- 限流：IP/连接/请求级别；支持熔断与恢复
- 资源上线：消息大小、连接数、队列深度；超限快速拒绝
- 特性开关：对于兼容窗口/灰度，必须默认关闭且有明示开关

八、运维与证书管理（生产）
- 证书目录：仅服务进程可读；变更采用热加载或平滑重启
- 轮换策略：到期前定时预警；失败回退到上一个可用证书
- 健康检查：握手成功率、失败码分布、平均/尾延迟

九、示例：标准失败消息
```json
{
  "type": "outline:update:failed",
  "request_id": "req-456",
  "error": {
    "code": "OUTLINE_NOT_FOUND",
    "message": "outline_id not found",
    "details": { "outline_id": "outlineItem-xyz" }
  }
}
```

十、执行清单（最小）
- [ ] 仅放行白名单消息类型（前后端一致）
- [ ] 强制 `wss://`（生产）；证书/权限/轮换策略就绪
- [ ] 每条请求超时；背压与尺寸限制开启
- [ ] 失败通道统一（含错误码与提示文案）；日志脱敏
- [ ] CI：`pnpm run ci:ws-types-diff` 通过

参考
- 事件规范：docs/standards/events.md
- 契约示例：docs/contracts/ws-outline.md
- 质量门禁：docs/quality/quality-gates.md
