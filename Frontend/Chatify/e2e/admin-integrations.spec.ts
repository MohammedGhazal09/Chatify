import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { User } from '../src/types/auth';

const artifactRoot = process.env.HERCULES_ARTIFACT_DIR
  ?? path.resolve(process.cwd(), '../../.planning/phases/54-bot-and-integration-permission-runtime/visual-qa');

const screenshotPath = (fileName: string) => path.join(artifactRoot, 'screenshots', fileName);

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const adminUser: User = {
  _id: 'phase54-admin',
  firstName: 'Phase',
  lastName: 'Admin',
  email: 'phase54-admin@example.test',
  username: 'phase54.admin',
  role: 'admin',
  authProvider: 'local',
  isVerified: true,
};

const integrationDiagnosticsPayload = {
  generatedAt: '2026-07-01T10:00:00.000Z',
  status: 'ok',
  apps: {
    total: 2,
    active: 2,
  },
  installations: {
    active: 3,
    revoked: 1,
  },
  runtime: {
    manifestReads: 5,
    deniedAccess: 0,
  },
  scopes: {
    'messages:read': 2,
    'webhooks:send': 1,
  },
  latestAuditAt: '2026-07-01T09:58:00.000Z',
};

const mockIntegrationsApi = async (
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
  await page.route('**/api/admin/integrations', (route) => {
    if (failDiagnostics) {
      fulfillJson(route, { status: 'error', message: 'integration unavailable' }, 503);
      return;
    }

    fulfillJson(route, {
      status: 'success',
      data: {
        integrations: integrationDiagnosticsPayload,
      },
    });
  });
};

const openIntegrationsFixture = async (
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
  await mockIntegrationsApi(page, options);
  await page.goto('/admin/integrations?chatTheme=light');
};

test('Phase 54 integrations desktop visual smoke', async ({ page }) => {
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

  await openIntegrationsFixture(page, { width: 1366, height: 768 });
  await expect(page.getByRole('heading', { name: 'Bot integrations' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Permission boundary' })).toBeVisible();
  await expect(page.getByText('Runtime manifest')).toBeVisible();
  await expect(page.getByText('Scope usage')).toBeVisible();
  await expect(page.getByText('integration-owner@example.test')).toHaveCount(0);
  await expect(page.getByText('plain-runtime-token')).toHaveCount(0);
  await page.screenshot({ path: screenshotPath('phase54-integrations-desktop.png'), fullPage: true });

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('Phase 54 integrations mobile visual smoke', async ({ page }) => {
  await openIntegrationsFixture(page, { width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Bot integrations' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Permission boundary' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase54-integrations-mobile.png'), fullPage: true });
});

test('Phase 54 integrations RTL visual smoke', async ({ page }) => {
  await openIntegrationsFixture(page, { width: 768, height: 1024 }, { locale: 'ar' });
  await expect(page.getByRole('heading', { name: 'تكاملات البوت' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'حدود الأذونات' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase54-integrations-rtl.png'), fullPage: true });
});

test('Phase 54 integrations non-admin visual smoke', async ({ page }) => {
  await openIntegrationsFixture(page, { width: 1366, height: 768 }, { role: 'user' });
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase54-integrations-non-admin.png'), fullPage: true });
});

test('Phase 54 integrations error visual smoke', async ({ page }) => {
  await openIntegrationsFixture(page, { width: 1366, height: 768 }, { failDiagnostics: true });
  await expect(page.getByRole('heading', { name: 'Bot integrations' })).toBeVisible();
  await expect(page.getByText('Integration diagnostics unavailable. Refresh or check backend readiness.')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase54-integrations-error.png'), fullPage: true });
});
