import { defineConfig, devices } from '@playwright/test';

const productionFrontendUrl = process.env.CHATIFY_PROD_FRONTEND_URL?.trim() || undefined;

export default defineConfig({
  testDir: './e2e',
  testMatch: [
    /production-smoke-config\.spec\.ts/,
    /chat-production.*\.spec\.ts/,
  ],
  fullyParallel: false,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-production', open: 'never' }],
  ],
  outputDir: 'test-results-production',
  use: {
    baseURL: productionFrontendUrl,
    channel: 'chrome',
    permissions: ['microphone', 'camera'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
    },
  },
  projects: [
    {
      name: 'production-desktop',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: productionFrontendUrl,
        channel: 'chrome',
      },
    },
  ],
});
