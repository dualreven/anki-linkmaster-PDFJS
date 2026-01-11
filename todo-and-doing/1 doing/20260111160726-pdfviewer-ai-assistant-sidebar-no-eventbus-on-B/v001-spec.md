# PDFViewer ai-assistant：侧边栏去 EventBus 直连（B）规格说明

**功能ID**: 20260111160726-pdfviewer-ai-assistant-sidebar-no-eventbus-on-B  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-11 16:07  
**状态**: 进行中

## 现状说明
- `src/frontend/pdf-viewer/features/ai-assistant/components/ai-assistant-sidebar-ui.js` 在组件内部直接 `eventBus.on(PDF_VIEWER_EVENTS.ANNOTATION.*)` 并手工 off。
- 这属于“组件直接订阅领域事件”的面条化风险点，且与 annotation/store 驱动方向不一致。

## 提出需求（目标）
1) 移除组件内 `eventBus.on/off`，改为 **store 驱动**（优先：订阅 `annotationManager.store` 或同等真源）。  
2) 组件只做 UI：下拉选项刷新由 store 变化触发，而非依赖 CREATED/DELETED 事件。  
3) 补 1 条防回归测试：验证 store 更新后下拉选项刷新；destroy 后不再响应 store 变化。

## 约束条件（硬规则）
### 严格隔离（scope 不可重叠）
- **允许修改 scope**：
  - `src/frontend/pdf-viewer/features/ai-assistant/**`
- **禁止修改**：
  - `.kilocode/rules/memory-bank/**`
  - `src/frontend/pdf-viewer/features/pdf-annotation/**`

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
   - `todo-and-doing/1 doing/20260111160726-pdfviewer-ai-assistant-sidebar-no-eventbus-on-B/working-log.md`
   - `todo-and-doing/1 doing/20260111160726-pdfviewer-ai-assistant-sidebar-no-eventbus-on-B/report.md`

