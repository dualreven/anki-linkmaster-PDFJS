# Working Log（E）- 20260109191325-pdf-url-loader-uninstall-hardening-E

## 1. 结论摘要
- 泄漏点：`install` 注册了 `FILE.LOAD.SUCCESS`/`LOAD.FAILED`/`URL_PARAMS.REQUESTED` 三个订阅，但 `uninstall` 仅重置引用，未调用返回的 cleanup 函数导致 url-loader 在 Feature 重装或停用后继续响应事件。
- 修复：`#setupEventListeners` 记录 `eventBus.on` 返回的清理函数，`uninstall` 调用 `#clearListeners`、归零面向状态（`#pendingManualNav`、`#navInProgress`、`#inflightNavKey`、`#container`）并同时切断 `eventBus`/`navigationService` 引用，防止残留订阅或 state 泄漏。
- 回归测试：新增 “卸载后应清理所有监听器” 用例，确保 cleanup 函数被调度。

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/pdf-url-loader/__tests__/url-navigation-feature.test.js -i`

## 3. 交付信息
- commit：待补充
