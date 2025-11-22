/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: 'tests/e2e/browser',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    ignoreHTTPSErrors: true
  },
  reporter: [['list']]
};

export default config;

