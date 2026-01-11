# PDFViewer infra-ui 副作用收敛与可卸载强化（B）规格说明

**功能ID**: 20260111140159-pdfviewer-infra-ui-side-effects-hardening-B  
**优先级**: 高  
**版本**: v001  
**创建时间**: 2026-01-11 14:01  
**状态**: 进行中

## 现状说明
- `src/frontend/pdf-viewer/features/infra-ui/**` 已有 coordinator/subscriptions 的拆分，但仍存在“副作用分散、卸载不完全、回归覆盖不足”的风险点。

## 存在问题
- document/window 监听器、timeouts、EventBus subscriptions 等副作用点若分散在多个模块/组件中，容易遗留泄漏与竞态。
- 需要继续推动“订阅/副作用上移到装配层（Feature install/uninstall）”的治理方向。

## 提出需求（目标）
1) 继续收敛 infra-ui 副作用点到 coordinator/装配层（可卸载、可测）。  
2) 强化 uninstall：确保 timeouts/listeners/subscriptions 全部对称清理（Fail-Fast，不做兜底）。  
3) 补 1 条防回归测试：覆盖“卸载后不残留副作用（至少一种：timeout 或 document listener 或 subscriptions）”。

## 非目标（本任务不做）
- 不改 infra-ui 以外的 feature（避免与 A/C/D/E 冲突）。
- 不更改全局事件白名单或 Event 常量定义（除非在 scope 内且可用测试证明必要）。

## 约束条件（硬规则）
### 仅修改本模块代码（严格隔离）
- **允许修改 scope**：
  - `src/frontend/pdf-viewer/features/infra-ui/**`
- **禁止修改**：
  - `.kilocode/rules/memory-bank/**`
  - `src/frontend/pdf-viewer/features/pdf-annotation/**`
  - `src/frontend/pdf-viewer/bootstrap/**`
  - `src/frontend/pdf-viewer/features/pdf-url-loader/**`

### 必须遵循模块规范
先阅读并遵守：
- `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- `docs/SPEC/PDF-VIEWER-EVENT-HANDLING-001.md`
- `docs/SPEC/FRONTEND-EVENT-BUS-001.md`
- `docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
1) **必须 git 提交**并提供 commit hash。  
2) **必须自验通过**：
   - `pnpm -s run lint`
   - `pnpm exec jest --runTestsByPath <本任务新增/改动测试文件路径> -i`
3) 必须更新：
   - `todo-and-doing/1 doing/20260111140159-pdfviewer-infra-ui-side-effects-hardening-B/working-log.md`
   - `todo-and-doing/1 doing/20260111140159-pdfviewer-infra-ui-side-effects-hardening-B/report.md`

