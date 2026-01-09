# Working Log（A）- 20260109175610-ui-keyboard-handler-leak-guard-A

## 1. 结论摘要
- 风险点：`KeyboardHandler.setupEventListener()` 在非 DomEventHub 路径会重复 `document.addEventListener("keydown", ...)`；且从 document 切到 DomEventHub 时不会移除旧 document 监听，导致重复触发与泄漏。
- 修复：为 KeyboardHandler 增加“当前监听模式/是否已注册”的状态跟踪，保证 setup 幂等；模式切换会清理旧监听；destroy/remove 会清理两条路径的监听。
- 回归测试：新增 `src/frontend/pdf-viewer/ui/__tests__/keyboard-handler.leak-guard.test.js`

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/ui/__tests__/keyboard-handler.leak-guard.test.js -i`

## 3. 交付信息
- commit：`eee8af0`
