# Logger 说明（前端）

相关源码：
- `src/frontend/common/utils/logger.js`：`Logger` 类 + `getLogger()` + 对外导出入口（保持文件 ≤ 500 行）。
- `src/frontend/common/utils/logger-runtime-config.js`：运行时配置/治理能力（全局配置、localStorage 启动覆盖、toast 策略等）。

## 对外 API（从 `logger.js` 导出）

- `LogLevel`：`debug | info | warn | error`
- `class Logger`
- `getLogger(moduleName, initialLogLevel?)`
- `setGlobalWebSocketClient(wsClient)`（兼容保留，不实际使用）

运行时治理能力（实现位于 `logger-runtime-config.js`，通过 `logger.js` 透出）：
- `configureLogger(options)`
- `setGlobalLogLevel(level)`
- `setModuleLogLevel(moduleName, level)`
- `enableAutoToast(options)`
- `disableAutoToast()`
- `setAutoToastLevels(levels)`
- `getAutoToastConfig()`
- `setToastPolicy(moduleName, policy)`
- `getToastPolicy()`
- `setDefaultToastEnabled(enabled)`

## AutoToast（全局自动 toast）

- `enableAutoToast({ levels?, defaultMs?, excludeModules? })`
  - `levels`：默认 `["error","warn","info"]`
  - `excludeModules`：按 `Logger` 的 `moduleName` 排除
- `disableAutoToast()`
- `setAutoToastLevels(levels)`
- `getAutoToastConfig()`：读取当前配置快照

## ToastPolicy（模块级策略）

- `setToastPolicy(moduleName, { enabled?, levels? })`
  - `enabled=false`：强制禁止该模块 toast
  - `levels=["error","warn",...]`：仅允许这些“日志级别”触发 toast
- `setDefaultToastEnabled(enabled)`：未命中模块策略时的默认行为
- `getToastPolicy()`：读取快照（`enabled` 会被规范化为布尔语义）

## 启动覆盖（环境 + localStorage）

`logger.js` 在模块加载时会调用 `logger-runtime-config.js` 的 `applyLoggerStartupOverridesFromEnvironment(...)`，读取并应用以下 localStorage key（读取失败会被忽略）：
- `LOG_LEVEL`
- `LOG_EVENT_SAMPLE_RATE`
- `LOG_RATE_LIMIT`（形如 `"120,1000"`）
- `LOG_DEDUP_WINDOW_MS`
- `LOG_EVENT_MAX_JSON`
- `LOG_EVENT_PRETTY`
- `LOG_AUTO_TOAST_ENABLED`
- `LOG_AUTO_TOAST_LEVELS`
- `LOG_AUTO_TOAST_MS`
- `LOG_AUTO_TOAST_EXCLUDE`

生产环境（`import.meta.env.PROD` 或 `NODE_ENV=production`）默认更“安静”（例如默认级别 `warn`、event pretty 关闭、采样率降低）。

## 开发调试（window 暴露）

在开发环境（或设置了 `window.__LOGGER_DEBUG__`）下，`logger.js` 会把常用函数挂到 `window`，便于在控制台手动调试：
- `window.getLogger / window.setGlobalLogLevel / window.LogLevel`
- `window.enableAutoToast / window.disableAutoToast / window.setAutoToastLevels / window.getAutoToastConfig`
- `window.setToastPolicy / window.getToastPolicy / window.setDefaultToastEnabled`

## 测试注意事项（Jest）

`jest.setup.js` 会全局 mock `src/frontend/common/utils/logger.js`（避免大量测试被 logger 影响）。
如果需要测试真实的运行时配置逻辑，请直接 import `src/frontend/common/utils/logger-runtime-config.js`，并使用 `resetLoggerRuntimeConfigForTest()` 清理全局状态。
