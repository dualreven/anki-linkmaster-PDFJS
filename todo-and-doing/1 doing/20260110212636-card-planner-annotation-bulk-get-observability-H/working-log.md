# 20260110212636-card-planner-annotation-bulk-get-observability-H 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 21:26
### 工作内容:
- 给新卡片规划器补齐 annotation meta 拉取状态可观测性，并做 toast 去重。
### 工作步骤:
1. 取证：定位 toast 重复触发路径（注入/粘贴 → onAfterIngestApplied）。
2. 设计：定义可测的去重规则与状态机（idle/loading/ok/failed）。
3. 实现：在状态栏/面板展示 `anno_meta` 与 last request_id。
4. 回归：补 Jest 覆盖状态流转与去重。
### 工作结果:
- （待实现）
### 存在问题:
- （待记录）
### 下一步计划:
- 提交功能 commit + 贴出 jest 通过结论。

## 工作记录2
**时间**: 2026-01-10 22:08
### 工作内容:
- 增加 annotation meta 拉取状态可观测（`anno_meta=idle|loading|ok|failed` + last request_id）。
- 增加 toast 去重：同错误消息在 2s 窗口内不重复弹出。
### 工作步骤:
1) 扩展 `ws-status-panel`：显示 `anno_meta`，并输出 `anno_rid/anno_error`。
2) 扩展 `annotation-meta-adapter`：增加 `onStatus` 回调，上报 loading/ok/failed（含 request_id）。
3) `planner/app.js` 接入：面板状态更新 + meta 拉取失败 toast 去重。
4) Jest：补齐面板 idle→loading→failed 覆盖；补齐去重器契约回归。
5) 验收：`pnpm -s run lint`；`pnpm exec jest --runTestsByPath <新增/改动测试> -i`。
### 工作结果:
- 交付 commit：`22dbb37c`
- Lint：通过（`pnpm -s run lint`）。
- Jest：通过
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/ws-status-panel.contract.test.js -i`
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/__tests__/toast-dedupe.contract.test.js -i`
### 存在问题:
- 无
