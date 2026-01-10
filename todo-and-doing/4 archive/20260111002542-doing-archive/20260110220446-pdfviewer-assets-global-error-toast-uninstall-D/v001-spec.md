# PDFViewer assets：GlobalErrorToast 可卸载（禁止残留全局监听）

**功能ID**: 20260110220446-pdfviewer-assets-global-error-toast-uninstall-D
**优先级**: 中（P0/P1：减少全局污染，明确生命周期）
**版本**: v001
**创建时间**: 2026-01-10 22:04:46
**状态**: 设计中

## 现状说明
- `src/frontend/pdf-viewer/assets/global-error-toast.js` 直接绑定全局监听（`window.addEventListener("error"/"unhandledrejection", ...)`）。
- 风险：viewer destroy 后仍残留全局监听器，导致行为污染与潜在泄漏。

## 提出需求
- 将 GlobalErrorToast 改为可安装/可卸载的模块：
  - install 负责绑定（只能绑定一次）
  - uninstall 负责解绑（必须解绑成功）
  - 不允许静默兜底：参数/状态异常必须抛错

## 解决方案（建议）
- 将现有“立即绑定”的行为改为显式 API：
  - `installGlobalErrorToast({ ...deps })` / `uninstallGlobalErrorToast()`
  - 或导出 class/feature，保持与其他 feature 一致
- 若需要复用现有工具（例如 `global-listener-scope`），仅允许“调用既有 API”，禁止修改 core 文件（避免与 A 冲突）。

## 约束条件（代码隔离：必须遵守）
### 允许修改的 scope（不允许越界）
- `src/frontend/pdf-viewer/assets/global-error-toast.js`
- `src/frontend/pdf-viewer/assets/__tests__/**`
- **禁止修改**：`src/frontend/pdf-viewer/core/**`（避免与 A 冲突）
- **禁止修改**：`scripts/ci/**`（避免与 E 冲突）
- **禁止修改**：`.kilocode/rules/memory-bank/context.md`（由规划者统一维护）

### 规范
- 先读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 测试清理：`docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD）
- 必须 `git commit` 并提供 **commit hash**
- 回归测试（至少 2 条）：
  1) install→uninstall：removeEventListener 被调用且参数一致（可 spy）
  2) uninstall 后触发 error/unhandledrejection 不再触发 toast handler
- 门禁：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath <本任务测试路径> -i` ✅

## 交付格式
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `src/frontend/pdf-viewer/assets/global-error-toast.js` + `src/frontend/pdf-viewer/assets/__tests__/**`
- `tests`: `pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
