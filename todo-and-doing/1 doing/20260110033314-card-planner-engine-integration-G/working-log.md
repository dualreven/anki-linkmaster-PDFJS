# 20260110033314-card-planner-engine-integration-G 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 03:33:14
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 阅读 `docs/contracts/card-planner.md`
2. 给 CardsEngine 增加快照 API（只读）
3. UI 切换到真实引擎（替换 FakeEngine）
4. 删除/收敛 shadow 真源
5. 新增/扩展回归测试并通过门禁
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 完成交付并回填 commit hash

## 工作记录2
**时间**: 2026-01-10 04:00:52
### 工作内容:
- UI 从 `FakeEngine` 切换为真实引擎 `createCardsEngine()`，并移除 shadow 真源，meta 预览由引擎快照驱动。
### 工作步骤:
1. 新增集成回归测试：`src/frontend/new-card-scheduler/__tests__/card-planner.engine-integration.contract.test.js`
2. `CardsEngine` 增加 `getDraftCardsSnapshotOrThrow()`
3. `planner/app.js` 改为引擎快照驱动 meta 预览（不再维护 `shadowByTempId`）
4. 调整 wiring：`onAfterIngestApplied({ annotationIds })` 且对 ingest 全量触发
5. 跑门禁与回归测试
### 工作结果:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/card-planner.engine-integration.contract.test.js -i` ✅
### 存在问题:
- 无
### 下一步计划:
- 等你手工点检：打开 `http://localhost:<vite_port>/new-card-scheduler/`，粘贴 `ann_1;ann_2`，观察计数与 meta 预览同步更新。
