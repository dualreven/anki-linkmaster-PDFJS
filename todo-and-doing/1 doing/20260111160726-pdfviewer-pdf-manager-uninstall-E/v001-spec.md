# PDFViewer pdf-manager：订阅/卸载契约加固（E）规格说明

**功能ID**: 20260111160726-pdfviewer-pdf-manager-uninstall-E  
**优先级**: 中  
**版本**: v001  
**创建时间**: 2026-01-11 16:07  
**状态**: 进行中

## 现状说明
- `src/frontend/pdf-viewer/pdf/pdf-manager-refactored.js` 内存在 `eventBus.on(...)`（setup listeners），但“卸载/销毁是否对称”需要用更明确的契约与回归测试锁死。
- `src/frontend/pdf-viewer/features/pdf-manager/index.js` 负责装配/卸载，应成为唯一订阅与清理的责任边界。

## 提出需求（目标）
1) 收敛订阅与清理责任：确保 `PDFManagerFeature.uninstall()` 能对称清理 `PDFManager` 的所有订阅/监听（Fail-Fast，不做兜底）。  
2) 若 `PDFManager` 需要 destroy/uninstall API，则补齐并由 feature 调用（并保持现有公开行为不变）。  
3) 补 1 条防回归测试：uninstall 后触发相关事件不应再被处理（可通过 spy/计数器断言）。

## 约束条件（硬规则）
### 严格隔离（scope 不可重叠）
- **允许修改 scope**：
  - `src/frontend/pdf-viewer/features/pdf-manager/**`
  - `src/frontend/pdf-viewer/pdf/**`
- **禁止修改**：
  - `.kilocode/rules/memory-bank/**`
  - `src/frontend/pdf-viewer/features/pdf-outline/**`
  - `src/frontend/pdf-viewer/features/pdf-anchor/**`

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
   - `todo-and-doing/1 doing/20260111160726-pdfviewer-pdf-manager-uninstall-E/working-log.md`
   - `todo-and-doing/1 doing/20260111160726-pdfviewer-pdf-manager-uninstall-E/report.md`

