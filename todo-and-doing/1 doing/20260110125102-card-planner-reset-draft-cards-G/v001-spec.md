# [card-planner][G] 新卡片规划器：增加“清空草稿卡”能力（便于反复手工测试）

**功能ID**: 20260110125102-card-planner-reset-draft-cards-G  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-10 12:51:02  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-G`（worktree：`C:\Users\napretep\PycharmProjects\anki-linkmaster-G`）

## 背景
手工测试需要频繁回到“空状态”，当前只能手动删除/重启窗口。

## 目标
1) UI 顶部增加按钮 `清空草稿卡`：
   - 清空所有草稿卡
   - 清空 selectedTempId 与粘贴焦点 pasteFocus
2) 引擎接口对齐：
   - `CardsEngine` 与 `FakeEngine` 增加同名方法 `resetDraftCardsOrThrow()`
3) 必须新增回归测试覆盖按钮行为与接口一致性。

## 约束
- 仅修改：`src/frontend/new-card-scheduler/**`
- Fail-Fast：缺失方法/DOM 节点必须抛错。

## 建议实现（可调整，DoD 不变）
- `CardsEngine.resetDraftCardsOrThrow()`：清空内部 cards、清空 selected、重置 tempId 计数器（如需要）；
- `FakeEngine.resetDraftCardsOrThrow()`：重置 state 到空数组与 selected=null；
- `planner/ui/workspace.js`：新增按钮调用 `engine.resetDraftCardsOrThrow()` 后 `render()`。

## 必须新增回归测试（至少 1 条）
建议扩展测试：
- `src/frontend/new-card-scheduler/__tests__/card-planner.engine-integration.contract.test.js`
覆盖：
1) 点击“清空草稿卡”后列表为空；
2) `engine.getState().selectedTempId === null`；
3) 再点击“新建空卡”仍正常（回归互斥问题）。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/card-planner.engine-integration.contract.test.js -i` ✅

