# 20260110033315-card-planner-annotation-meta-ws-H 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 03:33:15
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 对齐 `docs/contracts/card-planner.md` 7.4
2. app.js 默认改为 ws mode
3. 新增 adapter ws 回归测试
4. 验收：lint + jest by path
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 完成交付并回填 commit hash

## 工作记录2
**时间**: 2026-01-10 03:55:00
### 工作内容:
- 默认切换 `annotation-meta-adapter` 为 `mode=ws`，并在 UI 预览展示 `title/type`；失败不再静默吞错（toast 明确报错）。
- 新增 WS adapter 回归测试，并更新既有 UI & wiring 回归测试自动回包，避免超时。
### 工作步骤:
1. 对齐 `docs/contracts/card-planner.md` §7.4 消息契约（`annotation:bulk-get:*`）。
2. 新增测试：`src/frontend/new-card-scheduler/planner/adapters/__tests__/annotation-meta-adapter.ws.contract.test.js`。
3. 修改：`src/frontend/new-card-scheduler/planner/app.js` 默认 `mode=ws`，并在 catch 中 `notification.showError` Fail-Fast。
4. 修改：`src/frontend/new-card-scheduler/planner/ui/workspace.js` 元信息预览显示 `title (type)`（缺失 fallback 为 `id` / `unknown`）。
5. 修改：`src/frontend/new-card-scheduler/__tests__/card-planner.ui-and-wiring.contract.test.js`：拦截 `annotation:bulk-get:requested` 并回发 `completed`，并断言 UI 出现 `t_ann_1 (note)`。
6. 验收：`pnpm -s run lint`；`pnpm exec jest --runTestsByPath <新增/改动测试> -i`。
### 工作结果:
- Lint：通过（`pnpm -s run lint`）。
- Jest：通过
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/adapters/__tests__/annotation-meta-adapter.ws.contract.test.js -i`
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/card-planner.ui-and-wiring.contract.test.js -i`
### 交付信息:
- commit：`a6f127f`
### 存在问题:
- 无
### 下一步计划:
- 手工点检：启动 MsgCenter(8765) 后打开 `new-card-scheduler`，粘贴 `ann_id`，应看到 `title/type`（非 mock）。
