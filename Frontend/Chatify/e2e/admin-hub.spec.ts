import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { User } from '../src/types/auth';

const artifactRoot = process.env.HERCULES_ARTIFACT_DIR
  ?? path.resolve(process.cwd(), '../../.planning/phases/51-admin-navigation-and-operations-hub/visual-qa');

const screenshotPath = (fileName: string) => path.join(artifactRoot, 'screenshots', fileName);

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const adminUser: User = {
  _id: 'phase51-admin',
  firstName: 'Phase',
  lastName: 'Admin',
  email: 'phase51-admin@example.test',
  username: 'phase51.admin',
  role: 'admin',
  authProvider: 'local',
  isVerified: true,
};

const deliveryHealthPayload = {
  generatedAt: '2026-07-01T03:00:00.000Z',
  window: {
    key: '24h',
    startedAt: '2026-06-30T03:00:00.000Z',
    endedAt: '2026-07-01T03:00:00.000Z',
  },
  summary: {
    status: 'degraded',
    totalMessages: 22,
    sent: 5,
    delivered: 11,
    read: 6,
    staleSent: 2,
    staleDelivered: 1,
    deliveryRate: 72.5,
    readRate: 40,
  },
  riskConversations: [],
  runtime: {
    status: 'ok',
    socket: {
      initialized: true,
      connectedUsers: 3,
      connectedSockets: 4,
      pendingCallTimeouts: 0,
      pendingCallDisconnectCleanups: 0,
    },
  },
  outbox: {
    status: 'degraded',
    total: 2,
    attempts: 3,
    byStatus: { pending: 1, processing: 0, sent: 0, failed: 1 },
    byChannel: {
      email: {
        total: 1,
        attempts: 2,
        byStatus: { pending: 0, processing: 0, sent: 0, failed: 1 },
      },
      push: {
        total: 1,
        attempts: 1,
        byStatus: { pending: 1, processing: 0, sent: 0, failed: 0 },
      },
    },
  },
};

const privacyOperationsPayload = {
  generatedAt: '2026-07-01T04:00:00.000Z',
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
      startedAt: '2026-07-01T03:58:00.000Z',
      completedAt: '2026-07-01T04:00:00.000Z',
      counts: { deletionRequestsProcessed: 1 },
    },
  },
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

const mockAdminHubApi = async (
  page: Page,
  {
    role = 'admin',
    failSummaries = false,
  }: {
    role?: 'admin' | 'user';
    failSummaries?: boolean;
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
  await page.route('**/api/moderation/ops-summary', (route) => {
    if (failSummaries) {
      fulfillJson(route, { status: 'error', message: 'summary unavailable' }, 503);
      return;
    }

    fulfillJson(route, {
      status: 'success',
      data: {
        summary: {
          reportsByStatus: { open: 3, reviewed: 1, dismissed: 0, action_taken: 2 },
          appealsByStatus: { open: 1, under_review: 1, accepted: 0, rejected: 0 },
          unassignedOpen: 2,
          assignedToMeOpen: 1,
          oldestOpenAgeMinutes: 42,
        },
      },
    });
  });
  await page.route('**/api/admin/delivery-health**', (route) => {
    if (failSummaries) {
      fulfillJson(route, { status: 'error', message: 'delivery unavailable' }, 503);
      return;
    }

    fulfillJson(route, {
      status: 'success',
      data: {
        deliveryHealth: deliveryHealthPayload,
      },
    });
  });
  await page.route('**/api/admin/privacy-operations', (route) => {
    if (failSummaries) {
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
  await page.route('**/api/admin/integrations', (route) => {
    if (failSummaries) {
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

const openAdminHubFixture = async (
  page: Page,
  viewport: { width: number; height: number },
  options: {
    role?: 'admin' | 'user';
    failSummaries?: boolean;
    locale?: 'en' | 'ar';
  } = {}
) => {
  await page.setViewportSize(viewport);
  if (options.locale) {
    await page.addInitScript((locale) => {
      window.localStorage.setItem('chatify_locale', locale);
    }, options.locale);
  }
  await mockAdminHubApi(page, options);
  await page.goto('/admin?chatTheme=light');
};

test('Phase 51 admin hub desktop visual and navigation smoke', async ({ page }) => {
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

  await openAdminHubFixture(page, { width: 1366, height: 768 });
  await expect(page.getByRole('heading', { name: 'Operations hub' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open moderation queue' })).toHaveAttribute('href', '/admin/moderation');
  await expect(page.getByRole('link', { name: 'Open delivery health' })).toHaveAttribute('href', '/admin/delivery-health');
  await expect(page.getByRole('link', { name: 'Open privacy operations' })).toHaveAttribute('href', '/admin/privacy-operations');
  await expect(page.getByRole('link', { name: 'Open integrations' })).toHaveAttribute('href', '/admin/integrations');
  await expect(page.getByText('3 open')).toBeVisible();
  await expect(page.getByText('72.5%')).toBeVisible();
  await expect(page.getByText('Attention').first()).toBeVisible();
  await expect(page.getByText('Bot integrations')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase51-admin-hub-desktop.png'), fullPage: true });

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('Phase 51 admin hub mobile visual smoke', async ({ page }) => {
  await openAdminHubFixture(page, { width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Operations hub' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open moderation queue' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase51-admin-hub-mobile.png'), fullPage: true });
});

test('Phase 51 admin hub RTL visual smoke', async ({ page }) => {
  await openAdminHubFixture(page, { width: 768, height: 1024 }, { locale: 'ar' });
  await expect(page.getByRole('heading', { name: 'مركز العمليات' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'فتح قائمة الإشراف' })).toHaveAttribute('href', '/admin/moderation');
  await expect(page.getByRole('link', { name: 'فتح عمليات الخصوصية' })).toHaveAttribute('href', '/admin/privacy-operations');
  await expect(page.getByRole('link', { name: 'فتح التكاملات' })).toHaveAttribute('href', '/admin/integrations');
  await page.screenshot({ path: screenshotPath('phase51-admin-hub-rtl.png'), fullPage: true });
});

test('Phase 51 admin hub non-admin visual smoke', async ({ page }) => {
  await openAdminHubFixture(page, { width: 1366, height: 768 }, { role: 'user' });
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase51-admin-hub-non-admin.png'), fullPage: true });
});

test('Phase 51 admin hub summary error visual smoke', async ({ page }) => {
  await openAdminHubFixture(page, { width: 1366, height: 768 }, { failSummaries: true });
  await expect(page.getByRole('heading', { name: 'Operations hub' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open delivery health' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open integrations' })).toBeVisible();
  await expect(page.getByText('Unavailable').first()).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase51-admin-hub-summary-error.png'), fullPage: true });
});
