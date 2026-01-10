# PDFViewer infra-ui：移除 pdfId 兜底 + 清理 setTimeout 竞态

**功能ID**: 20260110195258-pdfviewer-infra-ui-remove-fallback-timeouts-B
**优先级**: 高（P1-B：去隐式行为，缩小耦合面）
**版本**: v001
**创建时间**: 2026-01-10 19:52:58
**状态**: 设计中

## 现状说明
- 位置（重点关注）：
  - `src/frontend/pdf-viewer/features/infra-ui/components/ui-manager-core-event-listeners.js`
  - `src/frontend/pdf-viewer/features/infra-ui/components/pdf-viewer-manager.js`（PDF.js → app event bridge）

## 存在问题
1) 隐式兜底（禁止）
- `onZoomChanged` 存在 filename→pdfId 的兜底推断（属于“非预期行为被悄悄吞掉”的典型回潮点）。
2) `setTimeout` 初始化页面信息
- `onFileLoadSuccess` 使用 `setTimeout(..., 100)` 作为竞态缓解，生命周期不清晰，难以稳定测试，也易遗留定时器。

## 提出需求
- 移除 filename→pdfId 兜底，并用 **显式错误/显式输入** 替代（Fail-Fast）。
- 移除/替代 `setTimeout` 初始化逻辑，改为基于明确事件（例如 render ready / page rendered）或可取消的订阅机制。

## 解决方案
- 兜底移除：
  - 删除 filename→pdfId 推断分支；
  - 若上游确实需要 pdfId：改为从 URL params/明确事件提供；若缺失则明确报错或发出错误事件（按统一错误规范）。
- `setTimeout` 清理：
  - 优先改为监听 `PDF_VIEWER_EVENTS.RENDER.READY` 或 `RENDER.PAGE_COMPLETED`（由 `PDFViewerManager` bridge 发出）触发一次性初始化；
  - 必须保证 uninstall/destroy 能解绑订阅（防泄漏）。

## 约束条件
### 允许修改的目录（scope）
- `src/frontend/pdf-viewer/features/infra-ui/**`

### 严格遵循代码规范和标准
- 先读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 错误格式：`docs/SPEC/ERROR-HANDLING-UNIFIED-001.md`
- 事件规范：`docs/SPEC/FRONTEND-EVENT-BUS-001.md`
- 测试清理：`docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准
### 单元测试（必需）
- 新增至少 1 条防回归测试：
  - 缺失 pdfId 时：不允许静默推断；必须走明确错误路径（Fail-Fast）。
  - 初始化流程：不依赖 `setTimeout` 的时间窗口（以事件/同步可控方式验证）。

### 门禁（必需）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增/改动测试路径> -i` ✅

## 协作协议（必须遵守）
- 必须提交到 `anki-linkmaster-B` worktree，并给出 **commit hash**。
- `working-log.md` 必须记录：删除兜底点位、替代机制、回归测试路径与命令。
