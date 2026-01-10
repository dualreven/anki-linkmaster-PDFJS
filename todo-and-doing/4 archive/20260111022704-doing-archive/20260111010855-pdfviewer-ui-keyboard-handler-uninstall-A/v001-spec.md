# PDFViewer KeyboardHandler 可卸载化（A）规格说明

**功能ID**: 20260111010855-pdfviewer-ui-keyboard-handler-uninstall-A  
**优先级**: 中（P1）  
**版本**: v001  
**创建时间**: 2026-01-11 01:08（本地）  
**状态**: doing  

## 现状说明
- `src/frontend/pdf-viewer/ui/keyboard-handler.js` 负责键盘快捷键处理，但仍存在“可重复安装/监听清理不够显式”的维护风险。
- 已有回归测试：`src/frontend/pdf-viewer/ui/__tests__/keyboard-handler.leak-guard.test.js`（覆盖点不足，且缺少明确 uninstall 契约测试）。

## 存在问题
- 键盘事件属于全局/跨模块入口，一旦 destroy/uninstall 不对称，容易造成“全局行为污染”与难复现的面条回潮。
- 当前测试偏“防泄漏”而非“契约化”：缺少明确验证 install/uninstall 的幂等与解绑行为。

## 提出需求（目标）
1) 将 KeyboardHandler 的生命周期契约固化为：
   - `install()` 幂等（重复调用不重复绑定）
   - `uninstall()` 幂等（重复调用不抛错，且解绑对称）
2) 补齐至少 2 条防回归测试，覆盖 install/uninstall 的关键行为。

## 解决方案（建议方向）
- 优先做“最小可交付”改造：不改动外部调用协议，仅补齐内部状态与绑定/解绑对称。
- 如项目已有 DOM hub/manager 统一封装（例如 DomEventHub/DOMManager），可在 scope 内复用，避免造轮子。

## 约束条件（严格代码隔离）
### 允许修改（scope）
- `src/frontend/pdf-viewer/ui/keyboard-handler.js`
- `src/frontend/pdf-viewer/ui/__tests__/**`

### 禁止修改
- 禁止修改 `src/frontend/pdf-viewer/features/**`（避免与 B/C/D 冲突）
- 禁止改动跨模块契约（事件名/全局变量/URL 参数）除非在 spec 中明确列出并补测试

### 规范必读
- `src/frontend/pdf-viewer/docs/SPEC/SPEC-HEAD-pdf-viewer.json`

## 可行验收标准（DoD：没有 commit hash 就不算完成）
- 必须提交 git 并提供 **commit hash**（工作区干净）。
- 必须新增/更新 ≥2 个测试用例，且本任务相关测试可单独通过：
  - `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/ui/__tests__/keyboard-handler.leak-guard.test.js -i`
  - 如新增测试文件，需追加到命令中（明确到文件路径）
- `pnpm -s run lint` 通过。
- `working-log.md` 记录：改动范围、测试命令与结果、是否需要人工点检（通常不需要）。

