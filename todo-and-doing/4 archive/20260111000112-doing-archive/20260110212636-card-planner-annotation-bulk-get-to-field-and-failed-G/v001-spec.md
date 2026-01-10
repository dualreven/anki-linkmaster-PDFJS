# Card Planner - 修复 annotation:bulk-get 超时（补 to 字段 + 处理 failed + 统一后端消息 to）

**功能ID**: 20260110212636-card-planner-annotation-bulk-get-to-field-and-failed-G  
**优先级**: 高（P0：用户可见错误 toast）  
**版本**: v001  
**创建时间**: 2026-01-10 21:26  
**状态**: 设计中  

## 现状说明（用户验收事实）
- 草稿卡已注入成功，但新卡片规划器会弹出错误：`标注元信息拉取失败：annotation:bulk-get 超时`（截图显示可能重复弹出）。

## 存在问题（基于代码取证）
- MsgCenter 后端对非注册消息 **强制要求 `to` 字段**；缺失会返回 `*:failed`（`code=400 error_code=INVALID_TO_FIELD message=缺少 to 字段`）。
  - 证据：`src/backend/msgCenter_server/core/message_validator.py`
  - 证据：`src/backend/msgCenter_server/standard_server.py` 在 `handle_message()` 中对 `to` 校验失败直接返回 `*:failed`
- new-card-scheduler 的 `annotation:bulk-get:requested` 未带 `to:"backend"`，且 adapter 仅监听 `completed`，忽略 `failed` → UI 表现为“超时”。
  - 证据：`src/frontend/new-card-scheduler/planner/adapters/annotation-meta-adapter.js`

## 提出需求
1) `annotation:bulk-get:requested` 必须携带 `to:"backend"`，并在收到 `annotation:bulk-get:failed` 时 **立即** reject（禁止等待 timeout）。
2) 同类修复：新卡片规划器内所有“发往后端”的消息必须携带 `to:"backend"`（避免下一个回归点）：
   - `card-planner:final-output:requested`
   - planner 侧回执：`card-planner:ingest:*`、`card-planner:state:get:*`（如存在）
3) 避免重复错误 toast：同一次注入/粘贴触发的 annotation meta 拉取失败，最多提示一次（可用去重/节流策略，但必须有测试）。

## 解决方案（建议）
- `annotation-meta-adapter`：
  - 发包增加：`to: "backend"`
  - 同时监听 `annotation:bulk-get:completed` 与 `annotation:bulk-get:failed`（按 request_id 匹配）
  - `failed` 的 error message 优先取 `msg.error.message`（兜底取 `msg.message`）
- `final-output` 发包同样补 `to:"backend"`。
- planner 回执消息（如确实会从窗口发送到 MsgCenter）：补 `to:"backend"`，保持契约一致。
- toast 去重：对 `annotation meta fetch failed` 使用“request_id 级别去重”或“短窗口节流”（例如 2 秒内同文案只弹一次）。

## 约束条件
- 仅修改：
  - `src/frontend/new-card-scheduler/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`。
- 禁止做“缺少 to 时自动补 to”的兜底（非预期行为必须报错）。

## 可行验收标准
### 单元测试（必须新增/补齐）
- Jest（至少包含下面 3 类）：
  1) `annotation:bulk-get:requested` 发包必须包含 `to:"backend"`。
  2) 收到 `annotation:bulk-get:failed`（同 request_id）必须立即 reject，且错误信息可用于 UI 提示（不能走 timeout）。
  3) 同一次注入导致的连续失败，不允许重复弹 toast（以你实现的去重策略为准）。

### 人工验收（给用户）
- 打开新卡片规划器 → 注入草稿卡：不再出现 `annotation:bulk-get 超时`；若后端明确返回失败，应显示更具体的失败原因（如“缺少 to 字段/后端插件不可用”等）。

