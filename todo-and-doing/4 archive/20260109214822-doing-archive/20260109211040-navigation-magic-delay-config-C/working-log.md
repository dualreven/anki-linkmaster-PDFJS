# Working Log（C）- 20260109211040-navigation-magic-delay-config-C

## 1. 结论摘要
- 新增配置项：`postPageReadyDelayMs`（默认 `100`，可设为 `0`）
- 行为变化：
  - 默认行为不变：`navigateTo()` 在 `waitForPageReady` 之后仍额外等待 100ms；
  - 测试/调参可将该等待设为 0，避免依赖真实等待。
- 回归测试：
  - `navigation-service.magic-delay-config.test.js`：
    - delay=0 时不推进 fake timers 也能完成；
    - 默认 delay=100 时，fake timers 不推进则不会完成，推进 100ms 后完成。

## 2. 验证记录
- [x] `pnpm -s run lint`
- [x] `pnpm exec jest --runTestsByPath src/frontend/pdf-viewer/features/infra-nav-core/__tests__/navigation-service.magic-delay-config.test.js -i`

## 3. 交付信息
- commit：见 `git log -1`（`worker/refactor-C`）
