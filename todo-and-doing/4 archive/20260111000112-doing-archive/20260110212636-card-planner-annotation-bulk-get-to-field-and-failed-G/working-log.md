# 20260110212636-card-planner-annotation-bulk-get-to-field-and-failed-G 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 21:26
### 工作内容:
- 接到用户验收反馈：注入成功但 `annotation:bulk-get` 超时 toast 仍出现。
### 工作步骤:
1. 复现：在新卡片规划器注入草稿卡，观察 toast 与 WS 往返消息。
2. 修复：为 `annotation:bulk-get` 与所有后端消息补齐 `to:"backend"`，并处理 `*:failed`。
3. 防回归：补 Jest，覆盖 `to`、`failed` 快速失败、toast 去重。
### 工作结果:
- `annotation:bulk-get:requested` 显式补齐 `to:"backend"`，并在 `annotation:bulk-get:failed` 时立即失败（不等 timeout）；同一错误 2 秒内 toast 去重；同类后端消息（final-output/回执）统一补齐 `to:"backend"`。
### 存在问题:
- 无
### 下一步计划:
- 提交功能 commit；手工验收：注入草稿卡后不再出现 `annotation:bulk-get 超时`，若失败应显示具体原因且不重复弹。

## 工作记录2
**时间**: 2026-01-10 22:17:12
### 工作内容:
- 修复 annotation meta 拉取：补 to 字段、处理 failed、toast 去重；并统一 planner 发往后端消息的 to 字段。
### 工作步骤:
1) `annotation-meta-adapter`：发包补 `to:"backend"`；监听 `annotation:bulk-get:failed` 立即 reject
2) `card-planner-message-types`：补齐 `ANNOTATION_BULK_GET_FAILED`
3) `planner/app.js`：final-output 发包补 `to:"backend"`；annotation meta 失败 toast 2 秒去重
4) `msgcenter-wiring`：planner 回执统一补 `to:"backend"`
5) Jest：补齐 3 类回归覆盖（to/failed/去重）并跑门禁
### 工作结果:
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/adapters/__tests__/annotation-meta-adapter.ws.contract.test.js -i` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/card-planner.engine-integration.contract.test.js -i` ✅
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/card-planner.final-output.ack.contract.test.js -i` ✅
