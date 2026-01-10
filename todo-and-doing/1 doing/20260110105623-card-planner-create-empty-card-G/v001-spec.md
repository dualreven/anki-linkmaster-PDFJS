# [card-planner][G] 新卡片规划器：支持“直接创建一张空卡”（UI 按钮）

**功能ID**: 20260110105623-card-planner-create-empty-card-G  
**优先级**: 高（解除人工测试阻塞）  
**版本**: v001  
**创建时间**: 2026-01-10 10:56:23  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-G`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-G`）

## 背景
当前 UI 主要依赖 Ingest 或外部消息来“产生草稿卡”，在缺乏外部条件时无法手工创建空卡来测试后续流程（选中/粘贴/最终输出）。

此外：`createCardPlannerApp` 的测试会使用 `FakeEngine`，而真实引擎为 `CardsEngine`，需要保持接口一致以避免 UI 分叉。

## 目标
1) 在新卡片规划器 UI 中提供显式按钮“新建空卡”，创建一张空卡（Q/A 都为空）并让其可被选中/可被粘贴。
2) 统一引擎接口：让 `CardsEngine` 与 `FakeEngine` 都提供同一个创建方法（Fail-Fast）。
3) 必须补充回归测试，防止 UI/引擎接口再次分叉。

## 约束
- 必须遵守 `docs/contracts/card-planner.md`（草稿卡能力、第 5 节粘贴交互）。
- Fail-Fast：缺少引擎方法/DOM 节点必须直接抛错，不得静默兜底。
- 仅修改：`src/frontend/new-card-scheduler/**`

## 建议实现（可调整，DoD 不变）
### 1) 引擎新增统一接口
为两种引擎同时新增方法（名称建议固定）：
- `createEmptyCardOrThrow(): string`

语义：
- 创建一张草稿卡（title=""，Q/A=[]），并将其设为 selected（便于后续粘贴/操作）。
- 返回该卡的 `tempId`。

实现点：
- `CardsEngine`：可复用现有 `createCardOrThrow()` + `setSelected(tempId)`。
- `FakeEngine`：在内部 state.cards push 新卡并 setSelected。

### 2) UI 增加按钮
在 `src/frontend/new-card-scheduler/planner/ui/workspace.js` 顶部按钮区增加：
- `新建空卡`

点击行为：
- 调用 `engine.createEmptyCardOrThrow()`；
- 清空粘贴焦点（避免误导）；触发 `render()`；
- 可选：toast `已创建空卡：tempId=...`（不强制）。

## 必须新增回归测试（至少 1 条）
建议 Jest 测试路径（二选一）：
- 新增：`src/frontend/new-card-scheduler/__tests__/card-planner.create-empty-card.contract.test.js`
- 或扩展：`src/frontend/new-card-scheduler/__tests__/card-planner.engine-integration.contract.test.js`

覆盖点（至少两项）：
1) 点击“新建空卡”后：列表卡片数 +1 且可见；
2) 新卡被设为 selected（引擎 state 中 `selectedTempId` 变更）；
3) `FakeEngine` 与 `CardsEngine` 均具备 `createEmptyCardOrThrow`（接口一致性）。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <你新增/修改的测试路径> -i` ✅
- 手工点检：打开 `http://localhost:3000/new-card-scheduler/`，点击“新建空卡”，应出现空卡并可点击 Q/A 设置粘贴焦点。

