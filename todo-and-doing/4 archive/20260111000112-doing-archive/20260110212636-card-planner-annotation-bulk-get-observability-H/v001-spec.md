# Card Planner - 可观测性：annotation meta 拉取状态（避免重复 toast）

**功能ID**: 20260110212636-card-planner-annotation-bulk-get-observability-H  
**优先级**: 中（P1：用户体验/排障效率）  
**版本**: v001  
**创建时间**: 2026-01-10 21:26  
**状态**: 设计中  

## 现状说明（用户现象）
- 注入成功后会弹出 `标注元信息拉取失败：annotation:bulk-get 超时`，并且截图显示 toast 可能重复出现两次。

## 存在问题
- 目前 UI 仅显示 `ws/reg`，看不到 annotation meta 拉取“是否正在请求/最后一次 request_id/最后一次失败原因”，排障需要看后端日志。
- toast 可能重复弹出，影响体验。

## 提出需求
1) 新卡片规划器界面需要可观测：
   - 显示 annotation meta 拉取的状态（例如 `anno_meta=idle|loading|ok|failed`）
   - 显示最后一次 `request_id`（便于对照 MsgCenter 日志）
2) 避免重复 toast：同一次注入/粘贴导致的连续失败，不允许重复弹出相同错误提示（以可测的去重规则为准）。

## 解决方案（建议）
- 在 `ws-status-panel`（或同级的 dev panel）增加一行/一段：
  - `anno_meta=<state>` + `rid=<lastRid>`（rid 可省略显示但需可获取）
- 通过一个小的 wiring/callback 注入状态变更（不要在多个文件到处写 DOM）。
- Jest：为面板渲染与状态流转补契约测试（至少覆盖 idle→loading→failed）。

## 约束条件
- 仅修改：
  - `src/frontend/new-card-scheduler/**`
- 禁止修改 `.kilocode/rules/memory-bank/**`。

## 可行验收标准
### 单元测试
- Jest：新增/调整 `ws-status-panel` 相关测试，覆盖 annotation meta 状态展示与去重策略。

### 人工验收（给用户）
- 注入草稿卡后：
  - 状态栏能看到 `anno_meta` 状态变化
  - 若失败，只弹一次错误 toast，且能从状态栏拿到 rid/状态

