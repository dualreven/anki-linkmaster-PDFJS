# PDFViewer pdf-annotation：ToggleButton 键盘监听器可卸载化（C）规格说明

**功能ID**: 20260111010855-pdfviewer-annotation-toggle-button-uninstall-C  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-11 01:08（本地）  
**状态**: doing  

## 现状说明
- `src/frontend/pdf-viewer/features/pdf-annotation/annotation-feature-toggle-button.js` 内部直接 `document.addEventListener("keydown", ...)`，且当前实现未暴露对称 uninstall，属于典型“全局监听器泄漏”风险点。

## 存在问题
- 该 listener 属于“跨 feature 的快捷键入口”，若 feature uninstall/destroy 后不解绑，会造成：
  - 键盘行为污染（其他窗口/其他 feature 误触发）
  - 难追踪的重复触发/内存泄漏

## 提出需求（目标）
1) 将 ToggleButton 监听器改为“可安装/可卸载”的对称结构（install/uninstall 或等价模式），并确保幂等。
2) 补齐至少 2 条回归测试：
   - 卸载后 keydown 不再触发 toggle 行为
   - 重复安装/卸载不导致多次触发（幂等/去重）

## 解决方案（建议方向）
- 优先保持对外 API 不变（`createAnnotationToggleButton(...)` 的返回结构与调用点兼容），仅在内部增加 destroy/uninstall 并由上层 `pdf-annotation/index.js` 对接。
- 所有异常/缺失依赖必须 fail-fast，不做兜底吞错。

## 约束条件（严格代码隔离）
### 允许修改（scope）
- `src/frontend/pdf-viewer/features/pdf-annotation/annotation-feature-toggle-button.js`
- `src/frontend/pdf-viewer/features/pdf-annotation/index.js`（仅限对接 uninstall；禁止改动其它工具逻辑）
- `src/frontend/pdf-viewer/features/pdf-annotation/__tests__/**`

### 禁止修改
- 禁止修改 `src/frontend/pdf-viewer/features/infra-ui/**`（避免与 B 冲突）
- 禁止修改 `src/frontend/pdf-viewer/features/pdf-search/**`（避免与 D 冲突）
- 禁止修改 `src/frontend/pdf-viewer/ui/**`（避免与 A 冲突）

### 规范必读
- `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
- 必须提交 git 并提供 **commit hash**（工作区干净）。
- 必须新增/更新 ≥2 个测试用例，并提供定向命令（文件路径）：
  - `pnpm exec jest --runTestsByPath <测试文件1> <测试文件2> -i`
- `pnpm -s run lint` 通过。
- `working-log.md` 写明：监听器绑定点、解绑点、以及与 `pdf-annotation` uninstall 的集成方式。

