# 20260110024408-new-card-scheduler-sidebar-push-F 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 02:44:08
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 阅读 `src/frontend/new-card-scheduler/index.html` 与 `src/frontend/pdf-home/style.css`（确认遮挡根因）
2. 实现 `planner-sidebar-controller.js`（Fail-Fast + dispose）
3. 在 `src/frontend/new-card-scheduler/main.js` 挂载 header toggle 按钮并接入 controller
4. 新增回归测试 `planner-sidebar-layout.push.contract.test.js`
5. 验收：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath ... -i`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 完成实现并交付 commit hash

## 工作记录2
**时间**: 2026-01-10 03:19:00
### 工作内容:
- 实现 new-card-scheduler 侧边栏 push layout（默认展开推开 280px；按钮切换收起/展开；dispose 解绑）并新增回归测试。
### 关键变更:
- `src/frontend/new-card-scheduler/planner/ui/planner-sidebar-controller.js`：`installPlannerSidebarControllerOrThrow(...)`（Fail-Fast + push/restore + dispose）
- `src/frontend/new-card-scheduler/main.js`：在 header `.toolbar-controls` 创建 toggle 按钮并安装 controller
- `src/frontend/new-card-scheduler/index.html`：新增 `./style.css` 引入，并把 `#window-controls-slot` 改为 `.toolbar-controls` 的子节点，避免覆盖按钮
- `src/frontend/new-card-scheduler/style.css`：补 `.sidebar.collapsed` 的 transform 收起效果（仅作用于 new-card-scheduler）
- `src/frontend/new-card-scheduler/__tests__/planner-sidebar-layout.push.contract.test.js`：覆盖默认展开、点击收起/展开、dispose 后点击不再改布局
### 验收命令与结果:
1. `pnpm -s run lint` ✅
2. `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/planner-sidebar-layout.push.contract.test.js -i` ✅
### 提交:
- commit: `8dc9f94`
### 存在问题:
- Jest 提示 `baseline-browser-mapping` 数据过旧（非本任务引入）。
### 下一步计划:
- 用户手工点检：打开 `/new-card-scheduler/`，点击按钮验证不再遮挡 `#planner-workspace`。
