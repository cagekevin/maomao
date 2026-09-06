import { defineConfig, devices } from '@playwright/test';

// L4 画布 E2E —— 真实浏览器回归（见 docs/REGRESSION-PLAN.md §3.3 第4步）
// 启动本地 dev server（vite, 端口 5180）后跑。CI 默认跳过，本地手动 `npm run test:e2e`。
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'tests/e2e/results.json' }]],
  use: {
    baseURL: 'http://localhost:5180',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // 自动拉起 dev server；若已在跑则复用
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5180',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
