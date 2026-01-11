# PDFViewer bootstrap 可取消等待/竞态收敛（D）规格说明

**功能ID**: 20260111140159-pdfviewer-bootstrap-cancellable-wait-D  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-11 14:01  
**状态**: 进行中

## 现状说明
- `src/frontend/pdf-viewer/bootstrap/**` 存在若干“等待/异步初始化”的链路；当用户快速关闭窗口或 uninstall 时，容易出现竞态（例如：卸载后回调继续执行）。

## 存在问题
- 等待期间无法取消：destroy/uninstall 后仍可能触发回调 → 未捕获异常/残留监听/重复初始化。
- 面条化风险：为“救火”会不断添加 flag/timeout 兜底，反而让链路更难推理。

## 提出需求（目标）
1) 把关键等待链路改为“可取消/可终止”（destroy/uninstall 触发后不再继续执行后续步骤）。  
2) 明确 Fail-Fast：取消/卸载后任何后续回调都应停止或抛出可控错误（不要静默吞掉）。  
3) 补 1 条防回归测试：覆盖“触发 uninstall/destroy 后，等待链路不再继续推进且不抛未捕获错误”。

## 非目标（本任务不做）
- 不改 pdf-search/pdf-outline 等其他 feature（避免与历史 D 范围回潮）。

## 约束条件（硬规则）
### 仅修改本模块代码（严格隔离）
- **允许修改 scope**：
  - `src/frontend/pdf-viewer/bootstrap/**`
- **禁止修改**：
  - `.kilocode/rules/memory-bank/**`
  - `src/frontend/pdf-viewer/adapters/**`
  - `src/frontend/pdf-viewer/features/infra-ui/**`
  - `src/frontend/pdf-viewer/features/pdf-annotation/**`
  - `src/frontend/pdf-viewer/features/pdf-url-loader/**`

### 必须遵循模块规范
先阅读并遵守：
- `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- `docs/SPEC/PDF-VIEWER-EVENT-HANDLING-001.md`
- `docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
1) **必须 git 提交**并提供 commit hash。  
2) **必须自验通过**：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径> -i`
3) 必须更新：
   - `todo-and-doing/1 doing/20260111140159-pdfviewer-bootstrap-cancellable-wait-D/working-log.md`
   - `todo-and-doing/1 doing/20260111140159-pdfviewer-bootstrap-cancellable-wait-D/report.md`

