# PDFViewer pdf-anchor：移除组件内 EventBus 订阅（A）规格说明

**功能ID**: 20260111160726-pdfviewer-anchor-sidebar-no-eventbus-on-A  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-11 16:07  
**状态**: 进行中

## 现状说明
- `src/frontend/pdf-viewer/features/pdf-anchor/components/anchor-sidebar-ui.js` 内仍存在 `eventBus.on(...)`（legacy bridge 路径）。
- 这会导致“组件直接订阅事件总线”的面条化回潮：订阅点分散、卸载契约难证明、后续容易继续堆逻辑。

## 存在问题
- 组件（UI）承担了跨层职责：既渲染 UI、又处理 EventBus 入站同步 store。
- 该模式在并行重构中最容易分叉：不同组件各自订阅同一事件，造成多真源/重复订阅/难排障。

## 提出需求（目标）
1) 彻底移除 `AnchorSidebarUI` 内的 `eventBus.on(...)`（包括 legacy bridge）。  
2) 事件订阅必须上移到 Feature/装配层（install/uninstall），或改为 store 驱动（推荐）。  
3) 补 1 条防回归测试：断言 **组件初始化/销毁过程中不会调用 `eventBus.on`**，且 uninstall 后不残留订阅。

## 非目标
- 不修改 pdf-annotation/pdf-outline/pdf-search 等其他 feature。
- 不新增“兜底回退”逻辑；不允许静默吞错。

## 约束条件（硬规则）
### 严格隔离（scope 不可重叠）
- **允许修改 scope**：
  - `src/frontend/pdf-viewer/features/pdf-anchor/**`
- **禁止修改**：
  - `.kilocode/rules/memory-bank/**`
  - 其他 worktree 的任务目录

### 必须先读规范
- `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- `docs/SPEC/PDF-VIEWER-EVENT-HANDLING-001.md`
- `docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
1) 必须 git 提交并提供 commit hash（工作区干净）。  
2) 必须自验通过：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径> -i`
3) 必须更新并提交：
   - `todo-and-doing/1 doing/20260111160726-pdfviewer-anchor-sidebar-no-eventbus-on-A/working-log.md`
   - `todo-and-doing/1 doing/20260111160726-pdfviewer-anchor-sidebar-no-eventbus-on-A/report.md`

