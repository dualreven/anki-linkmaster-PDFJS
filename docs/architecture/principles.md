# 设计原则（Fail‑Fast 等，索引版）

Fail‑Fast（无兜底）
- 配置/事件/消息/参数不合法一律失败；给出纠正信息
- 禁止隐式默认值与静默降级
- 前端以 toast + 结构化日志呈现错误；后端以 `*:failed` 带错误码与 message

编码规范
- UTF-8 + `\n`；目录 kebab-case
- 事件三段式 + 命名空间常量引用（详见 docs/standards/events.md）

质量控制
- Lint 门禁（事件命名/跨域 import 等）
- CI 契约差异检查（WS 类型集合）

参考
- 质量门禁：docs/quality/quality-gates.md
