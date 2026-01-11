# PDFViewer pdf-outline：OutlineToolbar 卸载契约补齐（D）规格说明

**功能ID**: 20260111160726-pdfviewer-outline-toolbar-uninstall-D  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-11 16:07  
**状态**: 进行中

## 现状说明
- `src/frontend/pdf-viewer/outline/components/outline-toolbar.js` 内部直接 `eventBus.on(...)`，且缺少显式 destroy/unsubscribe 对称契约。
- `src/frontend/pdf-viewer/features/pdf-outline/components/outline-sidebar-ui.js` 会创建 `OutlineToolbar`，但卸载链路的对称性需要用测试锁死，避免监听泄漏回潮。

## 提出需求（目标）
1) 为 `OutlineToolbar` 补齐 destroy/unsubscribe（或替换为装配层订阅），确保卸载对称。  
2) `pdf-outline` 卸载时必须调用 `OutlineToolbar.destroy()`（或等价清理）。  
3) 补 1 条防回归测试：验证 uninstall/destroy 后 `PDF_VIEWER_EVENTS.OUTLINE.SELECT.CHANGED` 不再触发 toolbar handler。

## 约束条件（硬规则）
### 严格隔离（scope 不可重叠）
- **允许修改 scope**：
  - `src/frontend/pdf-viewer/features/pdf-outline/**`
  - `src/frontend/pdf-viewer/outline/**`
- **禁止修改**：
  - `.kilocode/rules/memory-bank/**`
  - `src/frontend/pdf-viewer/features/pdf-anchor/**`
  - `src/frontend/pdf-viewer/pdf/**`

### 必须先读规范
- `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- `docs/SPEC/PDF-VIEWER-EVENT-HANDLING-001.md`
- `docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
1) 必须 git 提交并提供 commit hash。  
2) 必须自验通过：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径> -i`
3) 必须更新并提交：
   - `todo-and-doing/1 doing/20260111160726-pdfviewer-outline-toolbar-uninstall-D/working-log.md`
   - `todo-and-doing/1 doing/20260111160726-pdfviewer-outline-toolbar-uninstall-D/report.md`

