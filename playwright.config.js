// DEPRECATED: 本项目的前端 E2E 已迁移到 QtWebEngine 基座（tests/e2e/qtwebengine）。
// 本配置仅为兼容保留，默认不再执行任何 Playwright 用例。
// 如需历史用例，请参考 tests/e2e/_legacy-playwright/ 与 README 说明。
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'tests/e2e/_legacy-playwright',
  // 忽略所有用例，防止误跑
  testIgnore: ['**/*'],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
    ignoreHTTPSErrors: true,
    // 可选：打开以调试
    // trace: 'on-first-retry',
    // screenshot: 'only-on-failure',
    // video: 'retain-on-failure'
  },
  reporter: [['list']],
};

export default config;
