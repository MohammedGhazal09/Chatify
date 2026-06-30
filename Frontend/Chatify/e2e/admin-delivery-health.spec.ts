import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { DeliveryHealthWindowKey } from '../src/api/deliveryHealthApi';
import type { User } from '../src/types/auth';

const artifactRoot = process.env.HERCULES_ARTIFACT_DIR
  ?? path.resolve(process.cwd(), '../../.planning/phases/49-delivery-health-dashboard/visual-qa');

const screenshotPath = (fileName: string) => path.join(artifactRoot, 'screenshots', fileName);

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const adminUser: User = {
  _id: 'phase49-admin',
  firstName: 'Phase',
  lastName: 'Admin',
  email: 'phase49-admin@example.test',
  username: 'phase49.admin',
  role: 'admin',
  authProvider: 'local',
  isVerified: true,
};

type DeliveryHealthVisualState = 'risk' | 'empty' | 'error';

const createDeliveryHealthPayload = (windowKey: DeliveryHealthWindowKey, state: DeliveryHealthVisualState = 'risk') => ({
  generatedAt: '2026-06-30T12:00:00.000Z',
  window: {
    key: windowKey,
    startedAt: windowKey === '7d' ? '2026-06-23T12:00:00.000Z' : '2026-06-29T12:00:00.000Z',
    endedAt: '2026-06-30T12:00:00.000Z',
  },
  summary: {
    status: 'degraded',
    totalMessages: windowKey === '7d' ? 18 : 12,
    sent: windowKey === '7d' ? 5 : 3,
    delivered: 5,
    read: 8,
    staleSent: 2,
    staleDelivered: 1,
    deliveryRate: windowKey === '7d' ? 72.2 : 75,
    readRate: windowKey === '7d' ? 44.4 : 33.3,
  },
  riskConversations: state === 'empty' ? [] : [{
    chatId: 'phase49-risk-chat-001',
    kind: 'direct',
    memberCount: 2,
    recentMessages: 8,
    staleSent: 2,
    staleDelivered: 1,
    unreadEstimate: 4,
    riskScore: 12,
    latestActivityAt: '2026-06-30T11:45:00.000Z',
    flags: {
      hasStaleSent: true,
      hasStaleDelivered: true,
      hasUnreadEstimate: true,
    },
  }],
  runtime: {
    status: 'ok',
    socket: {
      initialized: true,
      connectedUsers: 4,
      connectedSockets: 5,
      pendingCallTimeouts: 0,
      pendingCallDisconnectCleanups: 1,
    },
  },
  outbox: {
    status: 'degraded',
    total: 3,
    attempts: 5,
    byStatus: {
      pending: 1,
      processing: 0,
      sent: 1,
      failed: 1,
    },
    byChannel: {
      email: {
        total: 2,
        attempts: 4,
        byStatus: {
          pending: 1,
          processing: 0,
          sent: 0,
          failed: 1,
        },
      },
      push: {
        total: 1,
        attempts: 1,
        byStatus: {
          pending: 0,
          processing: 0,
          sent: 1,
          failed: 0,
        },
      },
    },
  },
});

const mockAdminDeliveryHealthApi = async (
  page: Page,
  {
    role = 'admin',
    state = 'risk',
  }: {
    role?: 'admin' | 'user';
    state?: DeliveryHealthVisualState;
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
  await page.route('**/api/admin/delivery-health**', (route) => {
    if (state === 'error') {
      fulfillJson(route, { status: 'error', message: 'Delivery diagnostics unavailable' }, 503);
      return;
    }

    const url = new URL(route.request().url());
    const requestedWindow = url.searchParams.get('window');
    const windowKey: DeliveryHealthWindowKey = requestedWindow === '1h' || requestedWindow === '7d'
      ? requestedWindow
      : '24h';

    fulfillJson(route, {
      status: 'success',
      data: {
        deliveryHealth: createDeliveryHealthPayload(windowKey, state),
      },
    });
  });
};

const openDeliveryHealthFixture = async (
  page: Page,
  viewport: { width: number; height: number },
  options: {
    role?: 'admin' | 'user';
    state?: DeliveryHealthVisualState;
    locale?: 'en' | 'ar';
  } = {}
) => {
  await page.setViewportSize(viewport);
  if (options.locale) {
    await page.addInitScript((locale) => {
      window.localStorage.setItem('chatify_locale', locale);
    }, options.locale);
  }
  await mockAdminDeliveryHealthApi(page, options);
  await page.goto('/admin/delivery-health?chatTheme=light');
};

test('Phase 49 delivery health desktop visual and logic smoke', async ({ page }) => {
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

  await openDeliveryHealthFixture(page, { width: 1366, height: 768 });
  await expect(page.getByRole('heading', { name: 'Delivery health' })).toBeVisible();
  await expect(page.getByText('Messages')).toBeVisible();
  await expect(page.getByText('Conversation #at-001')).toBeVisible();
  await expect(page.getByText('Notification outbox')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase49-desktop-delivery-health.png'), fullPage: true });

  await page.getByRole('button', { name: '7 days' }).click();
  await expect(page.getByText('18')).toBeVisible();
  await expect(page.getByText('72.2%')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase49-desktop-window-7d.png'), fullPage: true });
  await page.getByRole('button', { name: 'Refresh diagnostics' }).click();
  await expect(page.getByText('Delivery health')).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('Phase 49 delivery health mobile visual smoke', async ({ page }) => {
  await openDeliveryHealthFixture(page, { width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Delivery health' })).toBeVisible();
  await expect(page.getByText('Conversation #at-001')).toBeVisible();
  await expect(page.getByText('Runtime')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase49-mobile-delivery-health.png'), fullPage: true });
});

test('Phase 49 delivery health tablet RTL and empty visual smoke', async ({ page }) => {
  await openDeliveryHealthFixture(page, { width: 768, height: 1024 }, { state: 'empty', locale: 'ar' });
  await expect(page.getByRole('heading', { name: 'صحة التسليم' })).toBeVisible();
  await expect(page.getByText('لا توجد مخاطر تسليم ضمن هذه النافذة')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase49-tablet-rtl-empty.png'), fullPage: true });
});

test('Phase 49 delivery health permission and error visuals', async ({ page }) => {
  await openDeliveryHealthFixture(page, { width: 1366, height: 768 }, { role: 'user' });
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase49-non-admin.png'), fullPage: true });
});

test('Phase 49 delivery health backend error visual', async ({ page }) => {
  await openDeliveryHealthFixture(page, { width: 1366, height: 768 }, { state: 'error' });
  await expect(page.getByText('Delivery diagnostics unavailable. Refresh or check backend readiness.')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase49-error.png'), fullPage: true });
});
