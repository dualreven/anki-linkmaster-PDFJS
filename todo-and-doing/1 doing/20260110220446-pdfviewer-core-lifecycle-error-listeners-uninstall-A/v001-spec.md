# PDFViewer Core：全局错误监听器可卸载（LifecycleManager）

**功能ID**: 20260110220446-pdfviewer-core-lifecycle-error-listeners-uninstall-A
**优先级**: 高（P0：防全局监听泄漏/重复注册）
**版本**: v001
**创建时间**: 2026-01-10 22:04:46
**状态**: 设计中

## 现状说明
- 目前 PDFViewer 存在多处 `window.addEventListener("error"/"unhandledrejection", ...)`。
- 目标是让全局监听器具备明确生命周期：install/uninstall 幂等且可证明不泄漏。

## 提出需求
- 以 `LifecycleManager` 为唯一入口，做到：
  - install 只能注册一次（重复调用要 Fail-Fast 或幂等，但必须可证明不会重复绑定）
  - uninstall 后不再响应（监听器被移除）
  - 不允许静默兜底：缺少依赖/状态异常必须抛错

## 解决方案（建议）
- 在 `LifecycleManager` 内收集 handler 引用并实现可卸载：
  - `window.addEventListener(...)` 与 `removeEventListener(...)` 的参数必须一致
  - 明确记录 installed 状态，重复 install 行为按规范处理

## 约束条件（代码隔离：必须遵守）
### 允许修改的 scope（不允许越界）
- `src/frontend/pdf-viewer/core/lifecycle-manager.js`
- `src/frontend/pdf-viewer/core/__tests__/**`
- **禁止修改**：`src/frontend/pdf-viewer/assets/**`（避免与 D 冲突）
- **禁止修改**：`.kilocode/rules/memory-bank/context.md`（由规划者统一维护）

### 规范
- 先读：`docs/SPEC/SPEC-HEAD-pdf-viewer.json`
- 测试清理：`docs/SPEC/FRONTEND-TEST-CLEANUP-001.md`

## 可行验收标准（DoD）
- 必须 `git commit` 并提供 **commit hash**（没有 hash 不算完成）
- 回归测试（至少 2 条）：
  1) install→install：不允许重复绑定（用 spy/计数断言）
  2) install→uninstall：必须解绑，且后续触发 error/unhandledrejection 不再进入 handler
- 门禁：
  - `pnpm -s run lint` ✅
  - `pnpm exec jest --runTestsByPath <本任务测试路径> -i` ✅

## 交付格式（复制到群里/issue）
- `commit(s)`: `<hash1> <hash2>`
- `scope`: `src/frontend/pdf-viewer/core/lifecycle-manager.js` + `src/frontend/pdf-viewer/core/__tests__/**`
- `tests`: `pnpm -s run lint` + `pnpm exec jest --runTestsByPath ... -i`
*** Add File: todo-and-doing/1 doing/20260110220446-pdfviewer-core-lifecycle-error-listeners-uninstall-A/working-log.md
# 20260110220446-pdfviewer-core-lifecycle-error-listeners-uninstall-A 工作日志
**参考标准**: v001-spec.md

## 工作记录1
**时间**: 2026-01-10 22:04:46
### 工作内容:
- 任务下发：LifecycleManager 全局错误监听器可卸载 + 防重复绑定。
### 下一步计划:
1. 读 `docs/SPEC/SPEC-HEAD-pdf-viewer.json`
2. 梳理 `lifecycle-manager.js` 的 install/uninstall 现状与绑定点
3. 写测试（至少 2 条）后再改实现
4. 提交 commit，记录验收命令与结果
