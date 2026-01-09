# Card Planner - Sidebar Toggle Button & Wiring（G）规格说明

**功能ID**: 20260110021211-card-planner-sidebar-toggle-button-G  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-10 02:12:11  
**预计完成**: 2026-01-10  
**状态**: 开发中  
**负责分支**: `worker/feature-G`

## 现状说明
- new-card-scheduler 左侧 `#planner-sidebar` 会遮挡主区域（缺少 push layout）。
- `index.html` 内侧边栏按钮区域 `#planner-layout-switcher` 位于 sidebar 内部：如果按钮放在这里，侧边栏收起后无法再次展开。

## 提出需求（用户确认）
- 折叠/展开只需按钮触发。
- 展开时主区域收缩（不被遮挡），收起时主区域扩张占满。

## 解决方案（G 负责：按钮创建 + wiring，不改 HTML）
在 `src/frontend/new-card-scheduler/main.js` 中：
1) 在 header 的 `.toolbar-controls` 内 **程序化创建** toggle 按钮（避免改 HTML、减少冲突）：
   - 文案：`收起工具栏` / `展开工具栏`
   - class：复用现有 `.btn`（来自 `pdf-home/style.css`）
2) 调用 F 提供的 `installPlannerSidebarLayoutOrThrow(...)`（或等价导出）：
   - 传入：`sidebarEl = #planner-sidebar`、`mainEl = .main-content`、`toggleButtonEl`（或按钮容器）
3) Fail-Fast：
   - 缺少 `.toolbar-controls` 或 sidebar/main 时直接抛错（禁止静默 fallback 到 body）
4) 需要保证不影响现有窗口控制条：
   - `#window-controls-slot` 内仍由 `WindowControlsComponent` 渲染
   - toggle 按钮插入不应破坏 `#window-controls-slot` 的存在

## 约束条件
- 仅修改：`src/frontend/new-card-scheduler/main.js`（必要时可新增 `src/frontend/new-card-scheduler/planner/ui/**` 的 glue 文件，但优先复用 F 的模块）
- 禁止修改：`.kilocode/rules/memory-bank/**`
- 禁止兜底：缺少 DOM 直接抛错。

## 验收（DoD）
- 必须提交到 `worker/feature-G`，工作区干净，并在 `working-log.md` 写明 commit hash。
- 必须通过：
  - `pnpm -s run lint`
- 手工点检（最低要求）：
  - 打开 `http://localhost:3000/new-card-scheduler/`
  - 点击按钮：sidebar 收起后 `#planner-workspace` 不被遮挡，主区域宽度扩张；再次点击恢复

*** Add File: todo-and-doing/1 doing/20260110021211-card-planner-sidebar-toggle-button-G/working-log.md
# 20260110021211-card-planner-sidebar-toggle-button-G 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 02:12:11
### 工作内容:
- 初始化任务（未开始编码）。
### 工作步骤:
1. 在 `main.js` 定位 header 工具条容器（`.toolbar-controls`）
2. 创建 toggle 按钮并插入（不改 HTML）
3. 调用 F 模块安装 sidebar layout 行为
4. 自检：`pnpm -s run lint`
### 工作结果:
- 待执行
### 存在问题:
- 待记录
### 下一步计划:
- 完成 wiring 并交付 commit hash

