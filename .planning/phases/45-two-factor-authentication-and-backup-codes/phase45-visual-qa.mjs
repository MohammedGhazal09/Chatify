import { chromium, expect } from 'file:///D:/Projects/Chatify/Frontend/Chatify/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const artifactRoot = process.argv[2];
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:5178';

if (!artifactRoot) {
  throw new Error('Usage: node phase45-visual-qa.mjs <artifactRoot> [baseUrl]');
}

const screenshotsDir = path.join(artifactRoot, 'screenshots');
const tracesDir = path.join(artifactRoot, 'traces');
const logsDir = path.join(artifactRoot, 'logs');
await mkdir(screenshotsDir, { recursive: true });
await mkdir(tracesDir, { recursive: true });
await mkdir(logsDir, { recursive: true });

const createdAt = '2026-06-30T07:45:00.000Z';
const requester = {
  _id: 'user-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  username: 'ada.lovelace',
  email: 'ada@example.test',
  authProvider: 'local',
  isVerified: true,
  role: 'user',
  twoFactorEnabled: false,
};
const grace = {
  _id: 'user-2',
  firstName: 'Grace',
  lastName: 'Hopper',
  username: 'grace.hopper',
  authProvider: 'local',
  isVerified: true,
};
const message = {
  _id: 'message-1',
  clientMessageId: null,
  chatId: 'chat-1',
  sender: grace._id,
  text: 'Ready for account security review',
  messageType: 'text',
  encryptionMode: 'standard',
  encryptedPayload: null,
  read: true,
  status: 'read',
  deliveredAt: createdAt,
  readAt: createdAt,
  readBy: [{ user: requester._id, readAt: createdAt }],
  reactions: [],
  attachments: [],
  deletedFor: [],
  deletedForEveryone: false,
  deletedBy: null,
  deletedAt: null,
  pinned: false,
  pinnedBy: null,
  pinnedAt: null,
  replyTo: null,
  createdAt,
  updatedAt: createdAt,
};
const chats = [{
  _id: 'chat-1',
  members: [requester, grace],
  unReadMessages: 0,
  isGroupChat: false,
  encryptionMode: 'standard',
  latestMessage: message,
  conversationControls: {
    isDirectChat: true,
    peerId: grace._id,
    canSendMessage: true,
    canBlockUser: true,
    canUnblockUser: false,
    blockedByMe: false,
    blockedMe: false,
    messagingDisabledReason: null,
  },
  organizationState: { muted: false, archived: false, pinned: false, favorite: false },
  createdAt,
  updatedAt: createdAt,
}];

const consoleMessages = [];
const networkFailures = [];
const apiRequests = [];
const unknownApiRequests = [];
const assertions = [];

const json = async (route, body, status = 200, headers = {}) => route.fulfill({
  status,
  contentType: 'application/json',
  headers,
  body: JSON.stringify(body),
});

const notificationPreferences = {
  pushEnabled: false,
  emailNotificationsEnabled: false,
  messagePreviewMode: 'none',
  emailUnsubscribed: false,
  pushSubscriptionCount: 0,
  mutedChatIds: [],
};

const makeSharedAssetsPayload = (kind = null) => ({
  status: 'success',
  data: {
    assets: [],
    sharedAssets: [],
    kind,
    cursor: { nextCursor: null, hasMore: false, limit: 50 },
    nextCursor: null,
    hasMore: false,
  },
});

const createMockState = (overrides = {}) => ({
  authenticated: true,
  twoFactorEnabled: false,
  backupCodesRemaining: 0,
  challengeToken: 'phase45-challenge-token',
  ...overrides,
});

const installMocks = async (page, state) => {
  page.on('console', (message) => {
    consoleMessages.push({ type: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => {
    consoleMessages.push({ type: 'pageerror', text: error.message });
  });
  page.on('requestfailed', (request) => {
    networkFailures.push({ url: request.url(), method: request.method(), failure: request.failure()?.errorText ?? 'unknown' });
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname.startsWith('/socket.io/')) {
      await route.abort('failed');
      return;
    }

    if (!pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    apiRequests.push({ method: request.method(), url: request.url() });

    if (pathname === '/api/csrf-token') {
      await json(route, { csrfToken: 'mock-csrf' }, 200, { 'set-cookie': 'XSRF-TOKEN=mock-csrf; Path=/; SameSite=Lax' });
      return;
    }
    if (pathname === '/api/auth/is-authenticated') {
      await json(route, { token: state.authenticated });
      return;
    }
    if (pathname === '/api/auth/refresh-token') {
      await json(route, { status: 'success' });
      return;
    }
    if (pathname === '/api/auth/login') {
      await json(route, {
        status: 'mfa_required',
        message: 'Two-factor verification required',
        data: {
          twoFactorRequired: true,
          challengeToken: state.challengeToken,
          expiresAt: '2026-06-30T08:00:00.000Z',
        },
      });
      return;
    }
    if (pathname === '/api/auth/2fa/challenge') {
      await json(route, { status: 'fail', message: 'Invalid two-factor code' }, 401);
      return;
    }
    if (pathname === '/api/user/get-logged-user') {
      await json(route, { status: 'success', user: { ...requester, twoFactorEnabled: state.twoFactorEnabled } });
      return;
    }
    if (pathname === '/api/auth/2fa/status') {
      await json(route, {
        status: 'success',
        data: {
          twoFactor: {
            enabled: state.twoFactorEnabled,
            available: true,
            backupCodesRemaining: state.backupCodesRemaining,
            pendingSetup: false,
          },
        },
      });
      return;
    }
    if (pathname === '/api/auth/2fa/setup') {
      await json(route, {
        status: 'success',
        data: {
          setup: {
            secret: 'JBSWY3DPEHPK3PXP',
            otpauthUrl: 'otpauth://totp/Chatify:ada@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Chatify',
            expiresAt: '2026-06-30T08:00:00.000Z',
          },
          twoFactor: {
            enabled: false,
            available: true,
            backupCodesRemaining: 0,
            pendingSetup: true,
          },
        },
      });
      return;
    }
    if (pathname === '/api/auth/2fa/confirm') {
      state.twoFactorEnabled = true;
      state.backupCodesRemaining = 10;
      await json(route, {
        status: 'success',
        data: {
          backupCodes: ['ABCDE-FGHIJ', 'KLMNO-PQRST', 'UVWXY-23456', '23456-ABCDE'],
          twoFactor: {
            enabled: true,
            available: true,
            backupCodesRemaining: 10,
            pendingSetup: false,
          },
        },
      });
      return;
    }
    if (pathname === '/api/auth/2fa/backup-codes/regenerate') {
      await json(route, {
        status: 'success',
        data: {
          backupCodes: ['VWXYZ-23456', 'ABCDE-789AB'],
          twoFactor: {
            enabled: true,
            available: true,
            backupCodesRemaining: 10,
            pendingSetup: false,
          },
        },
      });
      return;
    }
    if (pathname === '/api/auth/sessions') {
      await json(route, {
        status: 'success',
        data: {
          sessions: [{
            id: 'session-current',
            current: true,
            deviceLabel: 'Chrome on Windows',
            rememberMe: true,
            createdAt,
            lastUsedAt: createdAt,
            expiresAt: '2026-07-30T07:45:00.000Z',
          }],
        },
      });
      return;
    }
    if (pathname === '/api/user/notification-preferences') {
      await json(route, { status: 'success', data: { preferences: notificationPreferences } });
      return;
    }
    if (pathname === '/api/user/privacy/summary') {
      await json(route, {
        status: 'success',
        data: {
          exportVersion: '2026-06-30',
          deletionRequest: null,
          retentionSummary: { moderation: 'Abuse and security records may be retained.' },
        },
      });
      return;
    }
    if (pathname === '/api/moderation/my-enforcements') {
      await json(route, { status: 'success', data: { enforcements: [] } });
      return;
    }
    if (pathname === '/api/chat/get-all-chats') {
      await json(route, { status: 'success', data: { chats } });
      return;
    }
    if (pathname === '/api/chat/contact-requests') {
      await json(route, { status: 'success', data: { incoming: [], outgoing: [] } });
      return;
    }
    if (pathname === '/api/user/get-all-users') {
      await json(route, { status: 'success', users: [grace] });
      return;
    }
    if (pathname === '/api/user/online-users') {
      await json(route, {
        status: 'success',
        data: {
          onlineUsers: [{ ...grace, isOnline: true, isCallReachable: true }],
          allContacts: [{ ...grace, isOnline: true, isCallReachable: true, lastSeen: createdAt }],
        },
      });
      return;
    }
    if (pathname.startsWith('/api/user/online-status/')) {
      await json(route, { status: 'success', data: { ...grace, isOnline: true, isCallReachable: true } });
      return;
    }
    if (pathname === '/api/space') {
      await json(route, { status: 'success', data: { spaces: [] } });
      return;
    }
    if (pathname.startsWith('/api/message/get-all-messages/')) {
      await json(route, {
        status: 'success',
        data: {
          messages: [message],
          pagination: { currentPage: 1, totalPages: 1, totalMessages: 1, hasMore: false, limit: 50, nextCursor: null },
          cursor: { nextCursor: null, hasMore: false, limit: 50 },
          nextCursor: null,
          hasMore: false,
        },
      });
      return;
    }
    if (pathname === '/api/message/batch/unread-counts') {
      await json(route, { status: 'success', data: { counts: { 'chat-1': 0 } } });
      return;
    }
    if (/^\/api\/message\/[^/]+\/(unread-count|mark-read|read)$/.test(pathname)) {
      await json(route, { status: 'success', data: { unreadCount: 0, updatedCount: 0, messages: [], receipts: [] } });
      return;
    }
    if (/^\/api\/message\/[^/]+\/shared-assets$/.test(pathname)) {
      await json(route, makeSharedAssetsPayload(url.searchParams.get('kind')));
      return;
    }
    if (/^\/api\/message\/[^/]+\/pinned$/.test(pathname)) {
      await json(route, { status: 'success', data: { pinnedMessages: [], messages: [], limit: 20 } });
      return;
    }
    if (pathname.startsWith('/api/message/search/')) {
      await json(route, { status: 'success', data: { messages: [], query: url.searchParams.get('q') ?? '', limit: 25 } });
      return;
    }

    unknownApiRequests.push({ method: request.method(), url: request.url() });
    await json(route, { status: 'success', data: {} });
  });
};

const seedChatShell = async (context) => {
  await context.addInitScript(() => {
    window.localStorage.setItem('chatify_selected_chat_user-1', 'chat-1');
  });
};

const checkNoHorizontalOverflow = async (page, label) => {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));
  assertions.push({ label: `${label} horizontal overflow`, ...overflow });
  if (overflow.scrollWidth > overflow.clientWidth + 1 || overflow.bodyScrollWidth > overflow.bodyClientWidth + 1) {
    throw new Error(`${label} has horizontal overflow: ${JSON.stringify(overflow)}`);
  }
};

const snapshot = async (page, name, fullPage = false) => {
  const filePath = path.join(screenshotsDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage });
  assertions.push({ label: `screenshot:${name}`, path: filePath, fullPage });
};

const openSettings = async (page) => {
  await expect(page.getByTestId('chat-shell')).toBeVisible({ timeout: 15000 });
  const openAccountSettings = page.getByRole('button', { name: 'Open account settings' });
  if (await openAccountSettings.count()) {
    await openAccountSettings.first().click();
  } else {
    await page.getByRole('button', { name: 'Open settings' }).first().click();
  }
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });
};

const browser = await chromium.launch({ headless: true });
let status = 'passed';
let errorSummary = null;

try {
  const loginContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await loginContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const loginPage = await loginContext.newPage();
  await installMocks(loginPage, createMockState({ authenticated: false }));
  await loginPage.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await expect(loginPage.getByRole('heading', { name: 'Sign In' })).toBeVisible({ timeout: 15000 });
  await loginPage.getByLabel(/email address/i).fill('ada@example.test');
  await loginPage.getByLabel(/^password$/i).fill('Password123!');
  await loginPage.getByRole('button', { name: /sign in/i }).click();
  await expect(loginPage.getByRole('heading', { name: /two-factor verification/i })).toBeVisible();
  await checkNoHorizontalOverflow(loginPage, 'desktop login mfa challenge');
  await snapshot(loginPage, 'desktop-login-mfa-challenge');
  await loginPage.getByLabel(/verification code/i).fill('000000');
  await loginPage.getByRole('button', { name: /^verify$/i }).click();
  await expect(loginPage.getByText('Invalid two-factor code')).toBeVisible();
  await snapshot(loginPage, 'desktop-login-mfa-invalid-code');
  await loginContext.tracing.stop({ path: path.join(tracesDir, 'login-desktop.zip') });
  await loginContext.close();

  const desktopContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await seedChatShell(desktopContext);
  await desktopContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const desktop = await desktopContext.newPage();
  const desktopState = createMockState();
  await installMocks(desktop, desktopState);
  await desktop.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await openSettings(desktop);
  await expect(desktop.getByText('Two-factor authentication')).toBeVisible();
  await expect(desktop.getByText('Status: Off')).toBeVisible();
  await checkNoHorizontalOverflow(desktop, 'desktop settings 2fa off');
  await snapshot(desktop, 'desktop-settings-2fa-off');
  await desktop.getByLabel(/current password/i).fill('Password123!');
  await desktop.getByRole('button', { name: /start 2fa setup/i }).click();
  await expect(desktop.getByText('JBSWY3DPEHPK3PXP', { exact: true })).toBeVisible();
  await checkNoHorizontalOverflow(desktop, 'desktop settings 2fa setup');
  await snapshot(desktop, 'desktop-settings-2fa-setup-secret');
  await desktop.getByLabel(/authenticator or backup code/i).fill('123456');
  await desktop.getByRole('button', { name: /enable 2fa/i }).click();
  await expect(desktop.getByText('ABCDE-FGHIJ')).toBeVisible();
  await expect(desktop.getByText(/save these backup codes now/i)).toBeVisible();
  await checkNoHorizontalOverflow(desktop, 'desktop settings backup codes');
  await snapshot(desktop, 'desktop-settings-2fa-backup-codes');
  await desktopContext.tracing.stop({ path: path.join(tracesDir, 'settings-desktop.zip') });
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  await seedChatShell(mobileContext);
  await mobileContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const mobile = await mobileContext.newPage();
  await installMocks(mobile, createMockState({ twoFactorEnabled: true, backupCodesRemaining: 8 }));
  await mobile.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await mobile.getByRole('button', { name: 'Open conversations' }).click();
  await mobile.getByRole('button', { name: 'Open settings' }).first().click();
  await expect(mobile.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 });
  await expect(mobile.getByText(/backup codes remaining: 8/i)).toBeVisible();
  await checkNoHorizontalOverflow(mobile, 'mobile settings 2fa enabled');
  await snapshot(mobile, 'mobile-settings-2fa-enabled', true);
  await mobileContext.tracing.stop({ path: path.join(tracesDir, 'settings-mobile.zip') });
  await mobileContext.close();
} catch (error) {
  status = 'failed';
  errorSummary = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
  throw error;
} finally {
  await browser.close();
  const expectedSocketFailures = networkFailures.filter((failure) => failure.url.includes('/socket.io/')).length;
  const unexpectedNetworkFailures = networkFailures.filter((failure) => !failure.url.includes('/socket.io/'));
  const report = {
    status,
    errorSummary,
    mode: 'fallback-playwright-visual-qa',
    baseUrl,
    generatedAt: new Date().toISOString(),
    screenshotsDir,
    tracesDir,
    assertions,
    apiRequestCount: apiRequests.length,
    unknownApiRequests,
    expectedSocketFailures,
    unexpectedNetworkFailures,
  };
  await writeFile(path.join(logsDir, 'browser-console.json'), JSON.stringify(consoleMessages, null, 2));
  await writeFile(path.join(logsDir, 'browser-network-failures.json'), JSON.stringify(networkFailures, null, 2));
  await writeFile(path.join(logsDir, 'api-requests.json'), JSON.stringify(apiRequests, null, 2));
  await writeFile(path.join(artifactRoot, 'visual-qa-report.json'), JSON.stringify(report, null, 2));
  await writeFile(path.join(artifactRoot, 'coverage-ledger.md'), [
    '# Phase 45 Visual QA Coverage',
    '',
    '- Mode: fallback Playwright visual QA (Hercules artifact contract; no Hercules runner available in this environment).',
    `- Base URL: ${baseUrl}`,
    '- Viewports: desktop 1366x768, mobile 390x844.',
    '- Covered: login MFA challenge, invalid-code state, Settings 2FA off state, setup secret display, one-time backup-code display, mobile enabled state.',
    '- Screenshots: desktop-login-mfa-challenge, desktop-login-mfa-invalid-code, desktop-settings-2fa-off, desktop-settings-2fa-setup-secret, desktop-settings-2fa-backup-codes, mobile-settings-2fa-enabled.',
    `- Expected socket failures: ${expectedSocketFailures} (backend Socket.IO not part of this mocked UI harness).`,
    `- Unexpected network failures: ${unexpectedNetworkFailures.length}.`,
    `- Unknown API requests fulfilled with generic success: ${unknownApiRequests.length}.`,
    `- Status: ${status}.`,
    '',
  ].join('\n'));
}
