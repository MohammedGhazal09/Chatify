import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { User } from '../src/types/auth';

const artifactRoot = process.env.HERCULES_ARTIFACT_DIR
  ?? path.resolve(process.cwd(), '../../.planning/phases/53-privacy-operations-worker-and-retention-enforcement/visual-qa');

const screenshotPath = (fileName: string) => path.join(artifactRoot, 'screenshots', fileName);

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const adminUser: User = {
  _id: 'phase53-admin',
  firstName: 'Phase',
  lastName: 'Admin',
  email: 'phase53-admin@example.test',
  username: 'phase53.admin',
  role: 'admin',
  authProvider: 'local',
  isVerified: true,
};

const privacyOperationsPayload = {
  generatedAt: '2026-07-01T09:00:00.000Z',
  status: 'attention',
  deletionRequests: {
    pending: 2,
    due: 1,
    completed: 4,
  },
  retention: {
    cleanupBacklog: 3,
    notificationOutboxRetentionDays: 30,
    expiredExportAudits: 1,
    expiredPasswordResets: 1,
    expiredSessions: 0,
    terminalNotificationOutbox: 1,
  },
  worker: {
    enabled: true,
    intervalMs: 300000,
    batchSize: 25,
    lastRun: {
      _id: 'phase53-run',
      status: 'completed',
      trigger: 'worker',
      dryRun: false,
      startedAt: '2026-07-01T08:58:00.000Z',
      completedAt: '2026-07-01T09:00:00.000Z',
      counts: {
        deletionRequestsProcessed: 1,
        accountsAnonymized: 1,
      },
    },
  },
};

const mockPrivacyOperationsApi = async (
  page: Page,
  {
    role = 'admin',
    failDiagnostics = false,
  }: {
    role?: 'admin' | 'user';
    failDiagnostics?: boolean;
  } = {}
) => {
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/csrf-token', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('**/api/auth/is-authenticated', (route) => fulfillJson(route, { token: true }));
  await page.route('**/api/user/get-logged-user', (route) => fulfillJson(route, {
    status: 'success',
    user: {
      ...adminUser,
      role,
    },
  }));
  await page.route('**/api/admin/privacy-operations', (route) => {
    if (failDiagnostics) {
      fulfillJson(route, { status: 'error', message: 'privacy unavailable' }, 503);
      return;
    }

    fulfillJson(route, {
      status: 'success',
      data: {
        privacyOperations: privacyOperationsPayload,
      },
    });
  });
};

const openPrivacyOperationsFixture = async (
  page: Page,
  viewport: { width: number; height: number },
  options: {
    role?: 'admin' | 'user';
    failDiagnostics?: boolean;
    locale?: 'en' | 'ar';
  } = {}
) => {
  await page.setViewportSize(viewport);
  if (options.locale) {
    await page.addInitScript((locale) => {
      window.localStorage.setItem('chatify_locale', locale);
    }, options.locale);
  }
  await mockPrivacyOperationsApi(page, options);
  await page.goto('/admin/privacy-operations?chatTheme=light');
};

test('Phase 53 privacy operations desktop visual smoke', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
      consoleErrors.push(message.text());
    }
  });
  page.on('requestfailed', (request) => {
    if (!request.url().includes('/socket.io/')) {
      failedRequests.push(request.url());
    }
  });

  await openPrivacyOperationsFixture(page, { width: 1366, height: 768 });
  await expect(page.getByRole('heading', { name: 'Privacy operations' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Deletion queue' })).toBeVisible();
  await expect(page.getByText('Worker enabled')).toBeVisible();
  await expect(page.getByText('Retention cleanup')).toBeVisible();
  await expect(page.getByText('privacy-owner@example.test')).toHaveCount(0);
  await page.screenshot({ path: screenshotPath('phase53-privacy-operations-desktop.png'), fullPage: true });

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('Phase 53 privacy operations mobile visual smoke', async ({ page }) => {
  await openPrivacyOperationsFixture(page, { width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Privacy operations' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Deletion queue' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase53-privacy-operations-mobile.png'), fullPage: true });
});

test('Phase 53 privacy operations RTL visual smoke', async ({ page }) => {
  await openPrivacyOperationsFixture(page, { width: 768, height: 1024 }, { locale: 'ar' });
  await expect(page.getByRole('heading', { name: 'عمليات الخصوصية' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'قائمة الحذف' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase53-privacy-operations-rtl.png'), fullPage: true });
});

test('Phase 53 privacy operations non-admin visual smoke', async ({ page }) => {
  await openPrivacyOperationsFixture(page, { width: 1366, height: 768 }, { role: 'user' });
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase53-privacy-operations-non-admin.png'), fullPage: true });
});

test('Phase 53 privacy operations error visual smoke', async ({ page }) => {
  await openPrivacyOperationsFixture(page, { width: 1366, height: 768 }, { failDiagnostics: true });
  await expect(page.getByRole('heading', { name: 'Privacy operations' })).toBeVisible();
  await expect(page.getByText('Privacy diagnostics unavailable. Refresh or check backend readiness.')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase53-privacy-operations-error.png'), fullPage: true });
});
