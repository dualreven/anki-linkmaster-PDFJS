# Card Planner - Sidebar Push Layout（F）规格说明

**功能ID**: 20260110021210-card-planner-sidebar-push-layout-F  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-10 02:12:10  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/refactor-F`

## 现状说明
- `src/frontend/new-card-scheduler/index.html` 复用 `src/frontend/pdf-home/style.css`：
  - `.sidebar` 为 `position: absolute`（默认覆盖主区域）
- 当前 `new-card-scheduler` 没有像 `pdf-home` 那样的“push layout”逻辑，导致侧边栏遮挡 `#planner-workspace`。

## 提出需求（用户确认）
- 仅需折叠/展开（不做拖拽调宽）。
- 触发方式：按钮。
- 目标行为：
  - 展开侧边栏时：主区域向右收缩（不被遮挡）。
  - 收起侧边栏时：主区域扩张占满。

## 解决方案（F 负责：核心逻辑模块）
在 `new-card-scheduler` 内新增一个“侧边栏布局控制器”模块（建议路径）：
- `src/frontend/new-card-scheduler/planner/ui/sidebar-layout-controller.js`

要求：
1) 导出 `installPlannerSidebarLayoutOrThrow(...)`（或等价命名），并返回 `dispose()` 以便卸载。
2) Fail-Fast：
   - 缺少关键 DOM（`#planner-sidebar`、`.main-content`、按钮容器）必须直接抛错（禁止静默兜底）。
3) 默认状态：展开。
4) 展开时强制推开主区域（固定宽度 280px）：
   - `main.style.marginLeft = "280px"`
   - `main.style.width = "calc(100% - 280px)"`
5) 收起时恢复主区域：
   - 清空上述 inline style（回到占满）
6) 收起/展开的视觉效果：
   - 允许使用 `sidebar.style.transform = "translateX(-100%)"` 进行收起（依赖现有 `.sidebar { transition: transform ... }`）
   - 或新增 `collapsed` class（若新增 class，请确保 CSS 在 new-card-scheduler 范围内，不要改 pdf-home 的 sidebar feature）
7) 按钮由调用方传入或由模块创建（F 只管核心逻辑；按钮挂载位置由 G 负责）。

## 约束条件
- 仅修改：`src/frontend/new-card-scheduler/planner/ui/**`（新增文件为主）
- 禁止修改：`.kilocode/rules/memory-bank/**`
- 禁止兜底：任何非预期输入/DOM 缺失必须抛错。

## 验收（DoD）
- 必须提交到 `worker/refactor-F`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
- 交付信息（复制给调度者）：
  - `commit(s)`: `<hash>`
  - `scope`: `src/frontend/new-card-scheduler/planner/ui/**`
  - `tests`: `pnpm -s run lint`
  - `notes`: `导出函数签名 + dispose 行为`

