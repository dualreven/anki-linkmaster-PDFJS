# New Card Scheduler - Sidebar Push Layout（F）规格说明

**功能ID**: 20260110024408-new-card-scheduler-sidebar-push-F  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-10 02:44:08  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/refactor-F`（worktree: `C:\Users\napretep\PycharmProjects\anki-linkmaster-F`）

## 现状说明
- `src/frontend/new-card-scheduler/index.html` 复用 `src/frontend/pdf-home/style.css`：
  - `.sidebar` 为 `position:absolute`，默认会覆盖 `.main-content`，导致遮挡 `#planner-workspace`。
- 目标是实现“像 pdf-home 侧边栏那样的 push layout”，但本任务只做：**折叠/展开 + 主区域推开/恢复**，不做拖拽调宽。

## 用户确认需求
- 只要折叠/展开。
- 触发方式：按钮。
- 展开：主区域被推开（收缩），不被遮挡。
- 收起：主区域恢复占满（扩张）。

## 参考实现（只作对齐，不照搬 UI）
- push 逻辑参考：`src/frontend/pdf-home/features/sidebar/components/sidebar-container.js`
- collapsed 视觉参考：`src/frontend/pdf-home/features/sidebar/styles/sidebar.css`
- 回归测试参考：`src/frontend/pdf-home/features/sidebar/__tests__/sidebar-layout-push.test.js`

## 解决方案（F 全包：实现 + wiring + 回归测试 + 简要验收说明）
### A) 侧边栏布局控制器（新增）
- 新增：`src/frontend/new-card-scheduler/planner/ui/planner-sidebar-controller.js`
- 要求：
  1) `installPlannerSidebarControllerOrThrow({ sidebarEl, mainEl, toolbarEl, logger? }) -> { dispose, setCollapsedOrThrow, isCollapsed }`
  2) 默认展开（collapsed=false）。
  3) 展开时 push 主区域（固定宽度 280px）：
     - `mainEl.style.marginLeft = "280px"`
     - `mainEl.style.width = "calc(100% - 280px)"`
  4) 收起时恢复主区域（清空上述 inline style）。
  5) 收起/展开视觉：允许通过 `sidebarEl.classList.toggle("collapsed")`，并在 new-card-scheduler 范围内补齐 `.sidebar.collapsed { transform: translateX(-100%) }`（不要改 pdf-home sidebar feature）。
  6) Fail-Fast：缺少 DOM 或参数类型不对直接抛错（禁止兜底）。
  7) `dispose()` 必须解绑事件监听并清理按钮（如由 controller 创建）。

### B) Wiring（修改 main.js）
- 修改：`src/frontend/new-card-scheduler/main.js`
- 要求：
  - 在 header 的 `.toolbar-controls` 内创建 toggle 按钮（不要放在 sidebar 内，否则收起后无法展开）。
  - 按钮文本：`收起工具栏` / `展开工具栏`（任意中文均可，但必须自解释）。
  - 点击按钮切换 collapsed，并调用 controller 更新布局。

### C) 回归测试（必须新增）
- 新增测试：`src/frontend/new-card-scheduler/__tests__/planner-sidebar-layout.push.contract.test.js`
- 覆盖：
  1) 安装后默认展开：`.main-content` 被推开（marginLeft/width）
  2) 点击一次：sidebar 收起，主区域恢复
  3) 再点击：展开并再次推开
  4) dispose 后：再点击不应生效（至少不再改动布局）

## 约束条件
- 仅修改：
  - `src/frontend/new-card-scheduler/**`
- 禁止修改：
  - `.kilocode/rules/memory-bank/**`（由 main 侧统一更新）
- 禁止兜底：任何非预期输入/DOM 缺失必须报错。

## 验收（DoD）
- 必须提交到 `worker/refactor-F`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
  - `pnpm exec jest --runTestsByPath src/frontend/new-card-scheduler/__tests__/planner-sidebar-layout.push.contract.test.js -i`
- 手工点检（最低要求）：
  - 打开 `http://localhost:<vite_port>/new-card-scheduler/`（端口从 `logs/runtime-ports.json` 取，常见为 3000）
  - 点击按钮：侧边栏不再遮挡 `#planner-workspace`，主区域宽度随展开/收起变化

