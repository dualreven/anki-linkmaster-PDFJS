# NCS - “创建空卡”按钮（新卡片规划器内直接创建空卡）

**功能ID**: 20260111131008-ncs-create-empty-card-button-H  
**优先级**: P1（提升可用性，减少只能靠注入/粘贴的路径）  
**版本**: v001  
**创建时间**: 2026-01-11 13:10  
**状态**: doing  

## 需求 / 交付
在新卡片规划器 UI 内提供一个按钮，可直接创建一张空草稿卡：
1) 在 `#planner-layout-switcher` 区域（侧边栏工具区）将现有按钮改为“按钮组”：
   - 保留现有：`发射最终制卡信息`
   - 新增：`创建空卡`
2) 点击 `创建空卡`：
   - 调用 `engine.createEmptyCardOrThrow()`（已存在于 `CardsEngine`）
   - 触发 `workspace.render()` 刷新，并默认选中这张新卡（如 engine 已选中则 UI 应反映）
3) Fail-fast：任何异常必须 toast 显示（复用现有 notification）。

## 约束（隔离 scope，禁止重叠）
### 允许修改/新增（仅限）
- 修改：`src/frontend/new-card-scheduler/planner/app.js`
- 视需要修改 UI 组件（必须写死文件名，避免扩散）：
  - `src/frontend/new-card-scheduler/planner/ui/workspace.js`（仅当 render/selection 无法满足需求）
- 新增测试：
  - `src/frontend/new-card-scheduler/planner/__tests__/create-empty-card-button.contract.test.js`

### 禁止修改
- 禁止修改：`src/frontend/new-card-scheduler/features/**`、`src/frontend/new-card-scheduler/ui/ws-status-panel.js`
- 禁止修改：`.kilocode/rules/memory-bank/**`

## 测试建议（DoD 必须满足）
- `pnpm -s run lint`
- `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/planner/__tests__/create-empty-card-button.contract.test.js -i`
  - 构造 DOM（含 `#planner-layout-switcher` 与 `#planner-workspace`）
  - `createCardPlannerApp(...)` 后应存在 `创建空卡` 按钮
  - 点击后 `engine.getState().draftCardTempIds.length` 增加，且 UI 有渲染变化

## 完成定义（DoD）
- 必须提交 git，并在 `working-log.md` 写明 **commit hash**。
- 必须补回归测试。

