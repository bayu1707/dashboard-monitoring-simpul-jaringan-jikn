import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.NUXT_TEST_URL ?? 'http://127.0.0.1:3000',
    browserName: 'chromium',
    channel: process.env.CI ? undefined : 'chrome',
    viewport: { width: 1440, height: 900 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: process.env.CI
    ? [
        {
          command: 'php ../backend/artisan serve --host=127.0.0.1 --port=8000',
          url: 'http://127.0.0.1:8000/up',
          timeout: 60000,
        },
        {
          command: 'npm run dev -- --port 3000',
          url: 'http://127.0.0.1:3000/simpul-jaringan',
          timeout: 60000,
        },
      ]
    : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
});
