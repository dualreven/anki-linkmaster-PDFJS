# 任务说明（A）- KeyboardHandler 防重复注册（P1）

## 0. 任务目标
解决 `src/frontend/pdf-viewer/ui/keyboard-handler.js` 的潜在“全局 keydown 监听重复注册/泄漏”风险：
- 多次初始化/重建 Viewer 时不应叠加多个 `document.addEventListener('keydown', ...)`。

## 1. 范围限制
- 仅允许修改：
  - `src/frontend/pdf-viewer/ui/keyboard-handler.js`
  - `src/frontend/pdf-viewer/ui/__tests__/**`（新增/修改测试）
- **不要修改** `.kilocode/rules/memory-bank/**`。

## 2. 交付标准（DoD）
- 修复：重复调用 setup/attach 不会重复注册监听器；destroy/uninstall 必须移除监听器。
- 必须新增 1 条回归测试（mock `document.addEventListener/removeEventListener`，验证调用次数与解绑）。
- 门禁通过：`pnpm -s run lint` + `pnpm exec jest --runTestsByPath <测试> -i`

## 3. 提交要求
- 提交 1 个 commit（包含修复+测试）。
- 更新 `todo-and-doing/1 doing/20260109175610-ui-keyboard-handler-leak-guard-A/working-log.md`。

