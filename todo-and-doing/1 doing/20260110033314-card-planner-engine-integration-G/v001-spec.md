# Card Planner - Engine Integration（G）规格说明

**功能ID**: 20260110033314-card-planner-engine-integration-G  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-10 03:33:14  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-G`

## 真源（必须对齐）
- `docs/contracts/card-planner.md`

## 现状说明
- `new-card-scheduler` 当前仍默认使用 `FakeEngine`（用于并行解耦）。
- 真实引擎 `createCardsEngine()` 已存在并有契约回归测试（`src/frontend/new-card-scheduler/planner/__tests__/cards-engine.contract.test.js`），但尚未接入 UI 主流程。

## 目标
把 `new-card-scheduler` UI 从 `FakeEngine` 切换到真实引擎（CardsEngine），保证：
1) UI 功能不回退（选中/命名/删除/排序/粘贴插入/MsgCenter ingest/state/get）。
2) 侧边栏/主布局不受影响（此项由 F 已实现）。
3) meta 预览不再依赖 shadow map（避免真源重复），以引擎数据为准。

## 解决方案（建议）
### A) 引擎提供“可视化快照 API”
在 `src/frontend/new-card-scheduler/planner/cards-model.js` 中，为 `CardsEngine` 增加只读快照方法（Fail-Fast）：
- `getDraftCardsSnapshotOrThrow(): Array<{ tempId: string, title: string, Q: string[], A: string[] }>`

### B) UI 接入真实引擎
- 修改 `src/frontend/new-card-scheduler/main.js`：使用 `createCardsEngine()` 替代 `createFakeEngine()`。
- 修改 `src/frontend/new-card-scheduler/planner/ui/workspace.js`：优先使用快照 API 计算 QCount/ACount 与 meta 预览。
- 修改 `src/frontend/new-card-scheduler/planner/app.js`：移除 shadowByTempId（或让其完全由引擎快照驱动），避免双真源。

## 回归测试（必须新增或扩展）
- 新增/扩展测试（建议）：
  - `src/frontend/new-card-scheduler/__tests__/card-planner.engine-integration.contract.test.js`
- 覆盖：
  1) main.js 走真实引擎（可通过注入/导出工厂或轻量 mock 验证）
  2) 粘贴插入后，引擎快照 Q/A 数量变化，UI 展示计数同步

## 约束条件
- 仅修改：`src/frontend/new-card-scheduler/**`
- 禁止修改：`.kilocode/rules/memory-bank/**`
- Fail-Fast：缺失 DOM/参数非法直接抛错（禁止兜底）。

## 验收（DoD）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增测试文件路径> -i` ✅
- 手工点检：
  - 打开 `http://localhost:<vite_port>/new-card-scheduler/`
  - 选中卡片并点击 Q/A 后粘贴 `ann_1;ann_2`，计数与元信息预览应同步更新

