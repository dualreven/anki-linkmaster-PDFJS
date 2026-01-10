# Card Planner - ingest 处理的契约 ACK（Planner → MsgCenter，可观测+可测）

**功能ID**: 20260110172214-card-planner-ingest-contract-ack-H  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 17:22  
**状态**: 设计中  

## 现状说明
- 当前 ingest 链路：
  - MsgCenter 对 `card-planner:ingest:requested` 的 ACK 来自“转发成功/失败”（server ack），不代表 Planner 侧是否实际应用成功。
  - Planner 侧（`msgcenter-wiring.js`）目前仅 toast + render，不发送 `card-planner:ingest:completed/failed` 回执。
- 契约（`docs/contracts/card-planner.md` 7.1）明确：Planner 侧应有 `ingest:completed/failed` 的语义回执（即便上游暂时不消费，也应可用于后续联调与测试）。

## 提出需求
- Planner 在成功应用 ingest 后，应向 MsgCenter 发射：
  - `type=card-planner:ingest:completed`
  - `request_id` 复用原请求 `request_id`
  - 可选：携带最小 state（`draftCardTempIds/selectedTempId`）用于上游诊断
- ingest 失败时应发射：
  - `type=card-planner:ingest:failed`
  - `request_id` 复用原请求 `request_id`
  - 明确错误信息（Fail-Fast）

## 解决方案（建议）
- 修改 `src/frontend/new-card-scheduler/planner/wiring/msgcenter-wiring.js`：
  - ingest 成功路径：`respond(wsClient, {...completed...})`
  - ingest 失败路径：`respond(wsClient, {...failed...})`
- 注意：MsgCenter `to` 规则要求窗口发到后端时 `to` 为 `"backend"`（或由 WSClient 默认处理）；不得引入非法 `to`。

## 约束条件
- 仅修改前端新卡片规划器模块相关代码：
  - `src/frontend/new-card-scheduler/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`。

## 可行验收标准
### 单元测试（必须新增/补齐）
- Jest（契约回归）：
  - 构造一个 ingest 请求消息，驱动 wiring 处理后，断言 `wsClient.send(...)` 发射了 `card-planner:ingest:completed`（含同 request_id）。
  - 构造非法 op / annotation_ids，断言发射 `card-planner:ingest:failed`（含同 request_id，含明确错误 message）。

### 人工验收
- 用 `gui_launcher` 注入样例草稿卡后：
  - 后端日志应能看到来自 Planner 的 ingest completed/failed（用于诊断，不要求 GUI 展示）。

