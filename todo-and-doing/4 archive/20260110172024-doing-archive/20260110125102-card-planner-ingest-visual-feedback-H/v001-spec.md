# [card-planner][H] 新卡片规划器：注入/ingest 的可视化反馈（toast + render）

**功能ID**: 20260110125102-card-planner-ingest-visual-feedback-H  
**优先级**: 中（提升人工验收可见性）  
**版本**: v001  
**创建时间**: 2026-01-10 12:51:02  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-H`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-H`）

## 背景
当 gui_launcher forward 注入 `card-planner:ingest:requested` 时，planner 侧会应用到引擎，但人工难以确认“是否已注入成功/失败”。

此外：`card-planner:ingest:requested` 是 forward 路由；MsgCenter 已对发送者返回 completed/failed。planner 侧不应再尝试向 MsgCenter 发送 ingest 回执（否则将触发 to 字段校验问题或污染日志）。

## 目标
1) planner 收到 `card-planner:ingest:requested` 后：
   - 成功：toast `已注入 N 个标注到 Q/A`（或类似）并立即刷新 UI
   - 失败：toast 明确错误原因
2) 移除 planner 侧对 ingest 的 `wsClient.send` 回执发送（仅保留本地 UI 反馈与 render）。
3) 必须新增回归测试覆盖：收到 ingest requested → render + toast 调用。

## 约束
- 仅修改：`src/frontend/new-card-scheduler/**`
- Fail-Fast：非法 payload 仍应明确失败 toast（不得静默吞掉）。

## 建议实现
- 修改 `src/frontend/new-card-scheduler/planner/wiring/msgcenter-wiring.js`：
  - ingest requested 成功后：`engine.dispatchIngest(...)` → `onAfterIngestApplied` → 调用回调（例如传入 annotationIds/face）→ UI toast + render
  - ingest requested 失败：toast error（包含 err.message）
  - 移除 `respond(wsClient, ...)` 对 ingest completed/failed 的发送

## 必须新增回归测试（至少 1 条）
建议扩展：
- `src/frontend/new-card-scheduler/__tests__/card-planner.ui-and-wiring.contract.test.js`
覆盖：
1) 模拟收到 `card-planner:ingest:requested` 后 UI 计数变化并 toast info；
2) 非法 payload → toast error。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/card-planner.ui-and-wiring.contract.test.js -i` ✅

