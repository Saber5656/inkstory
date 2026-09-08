import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  globalTimeout: process.env.CI ? 540_000 : undefined,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args:
            process.env.INKSTORY_GPU === 'metal'
              ? ['--enable-gpu', '--use-angle=metal']
              : [],
        },
      },
    },
    {
      name: 'chromium-no-sw',
      grep: /privacy:/,
      use: { ...devices['Desktop Chrome'], serviceWorkers: 'block' },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'node tools/serve.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
