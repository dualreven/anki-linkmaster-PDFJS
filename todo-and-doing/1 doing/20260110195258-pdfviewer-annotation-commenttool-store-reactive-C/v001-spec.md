# PDFViewer pdf-annotation：CommentTool store-reactive（去 DATA.LOADED 依赖）

**功能ID**: 20260110195258-pdfviewer-annotation-commenttool-store-reactive-C
**优先级**: 高（P1-C：tools 从事件驱动渲染转为 state 驱动）
**版本**: v001
**创建时间**: 2026-01-10 19:52:58
**状态**: 设计中

## 现状说明
- `CommentTool` 目前依赖 `PDF_VIEWER_EVENTS.ANNOTATION.DATA.LOADED` 来补画/恢复 overlay：
  - `src/frontend/pdf-viewer/features/pdf-annotation/tools/comment/index.js`

## 存在问题
- “事件驱动渲染”容易与真实状态分叉：状态变化未经过该事件时，overlay 可能不同步。
- 面条回潮风险：未来其他 tool 继续依赖事件补画，数据流难追踪。

## 提出需求
- 让 `CommentTool` 的 overlay 恢复与更新完全由 **AnnotationManager 的 store/state** 驱动：
  - 不依赖 `DATA.LOADED` 作为必须信号。
  - 允许 `DATA.LOADED` 仅作为“加载完成提示”，但 overlay 逻辑必须能在没有该事件时正确工作（例如直接 store 变更）。

## 解决方案
- 订阅 `annotationManager.store`（或等价状态来源）：
  - 当 annotations 列表变化时，对 comment 类型进行 diff/重建（最小化重绘）。
  - 在 uninstall 时必须清理订阅（防泄漏）。
- 只保留必要事件：
  - CRUD 事件可用于“触发写入”，但渲染必须来自 state。

## 约束条件
### 允许修改的目录（scope）
- `src/frontend/pdf-viewer/features/pdf-annotation/**`

### 严格遵循代码规范和标准
- 先读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 测试清理：`docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准
### 单元测试（必需）
- 新增至少 1 条防回归测试：
  - “store 更新 → comment overlays 恢复/刷新” 不依赖 `DATA.LOADED` 事件。

### 门禁（必需）
- `pnpm -s run lint` ✅
- `pnpm exec jest --runTestsByPath <本任务新增/改动测试路径> -i` ✅

## 协作协议（必须遵守）
- 必须提交到 `anki-linkmaster-C` worktree，并给出 **commit hash**。
- `working-log.md` 必须记录：state 驱动策略（diff/全量）、清理点（unsub）、回归测试路径与命令。
