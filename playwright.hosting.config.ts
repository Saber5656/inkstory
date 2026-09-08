import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/hosting',
  timeout: 60000,
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4180',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'VITE_COI=sw VITE_BASE=/inkstory/ pnpm exec vite build --outDir dist-hosting && PORT=4180 STATIC_DIR=dist-hosting BASE_PATH=/inkstory/ HOST_HEADERS=meta node tools/serve.mjs',
    url: 'http://127.0.0.1:4180/inkstory/',
    timeout: 120000,
    reuseExistingServer: false,
  },
});
