// 明确使用 UTF-8 源文件
// Playwright 基本配置（最小化），仅跑 tests/e2e/browser 下的用例
// 约束：禁止兜底与回退；超时略宽以适配首次浏览器安装
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'tests/e2e/browser',
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

