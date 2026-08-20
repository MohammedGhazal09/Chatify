import { chromium, expect } from 'file:///D:/Projects/Chatify/Frontend/Chatify/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const artifactRoot = process.argv[2];
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:5179';

if (!artifactRoot) {
  throw new Error('Usage: node phase47-visual-qa.mjs <artifactRoot> [baseUrl]');
}

const screenshotsDir = path.join(artifactRoot, 'screenshots');
const tracesDir = path.join(artifactRoot, 'traces');
const logsDir = path.join(artifactRoot, 'logs');
await mkdir(screenshotsDir, { recursive: true });
await mkdir(tracesDir, { recursive: true });
await mkdir(logsDir, { recursive: true });

const createdAt = '2026-06-30T09:00:00.000Z';
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
const alan = {
  _id: 'user-3',
  firstName: 'Alan',
  lastName: 'Turing',
  username: 'alan.turing',
  authProvider: 'local',
  isVerified: true,
};

const messageDefaults = {
  clientMessageId: null,
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
  mentions: [],
  createdAt,
  updatedAt: createdAt,
};

const makeMessage = (overrides) => ({ ...messageDefaults, ...overrides });

const makeChat = (overrides) => ({
  unReadMessages: 0,
  encryptionMode: 'standard',
  conversationControls: {
    isDirectChat: false,
    peerId: null,
    canSendMessage: true,
    canBlockUser: false,
    canUnblockUser: false,
    blockedByMe: false,
    blockedMe: false,
    messagingDisabledReason: null,
  },
  organizationState: { muted: false, archived: false, pinned: false, favorite: false },
  createdAt,
  updatedAt: createdAt,
  ...overrides,
});

const groupMessage = makeMessage({
  _id: 'message-group-1',
  chatId: 'group-chat-1',
  sender: grace._id,
  text: 'Invite links should stay revokable.',
});
const directMessage = makeMessage({
  _id: 'message-direct-1',
  chatId: 'direct-chat-1',
  sender: grace._id,
  text: 'Direct chats do not expose invite links.',
});
const encryptedMessage = makeMessage({
  _id: 'message-encrypted-1',
  chatId: 'encrypted-group-1',
  sender: grace._id,
  text: '',
  messageType: 'encrypted',
  encryptionMode: 'e2ee_v1',
});
const spaceMessage = makeMessage({
  _id: 'message-space-1',
  chatId: 'space-chat-1',
  sender: alan._id,
  text: 'Space invite links add members to channels.',
});

const initialChats = [
  makeChat({
    _id: 'group-chat-1',
    chatName: 'Security working group',
    members: [requester, grace, alan],
    groupAdmin: requester,
    isGroupChat: true,
    latestMessage: groupMessage,
  }),
  makeChat({
    _id: 'direct-chat-1',
    members: [requester, grace],
    isGroupChat: false,
    latestMessage: directMessage,
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
  }),
  makeChat({
    _id: 'encrypted-group-1',
    chatName: 'Encrypted council',
    members: [requester, grace],
    groupAdmin: requester,
    isGroupChat: true,
    encryptionMode: 'e2ee_v1',
    latestMessage: encryptedMessage,
  }),
  makeChat({
    _id: 'space-chat-1',
    chatName: 'Release operations',
    channelName: 'release-ops',
    channelKey: 'release-ops',
    isSpaceChannel: true,
    spaceId: 'space-1',
    space: 'space-1',
    members: [requester, grace, alan],
    isGroupChat: true,
    latestMessage: spaceMessage,
  }),
];

const initialMessages = {
  'group-chat-1': [groupMessage],
  'direct-chat-1': [directMessage],
  'encrypted-group-1': [encryptedMessage],
  'space-chat-1': [spaceMessage],
};

const makeInvite = (overrides) => ({
  _id: 'invite-1',
  targetType: 'group',
  targetId: 'group-chat-1',
  createdBy: requester,
  expiresAt: '2026-07-07T09:00:00.000Z',
  maxUses: 5,
  useCount: 1,
  lastUsedAt: null,
  revokedAt: null,
  revokedBy: null,
  state: 'active',
  createdAt,
  updatedAt: createdAt,
  ...overrides,
});

const notificationPreferences = {
  pushEnabled: false,
  emailNotificationsEnabled: false,
  messagePreviewMode: 'none',
  emailUnsubscribed: false,
  pushSubscriptionCount: 0,
  mutedChatIds: [],
};

const consoleMessages = [];
const networkFailures = [];
const apiRequests = [];
const unknownApiRequests = [];
const assertions = [];
const inviteActions = [];

const clone = (value) => JSON.parse(JSON.stringify(value));
const json = async (route, body, status = 200, headers = {}) => route.fulfill({
  status,
  contentType: 'application/json',
  headers,
  body: JSON.stringify(body),
});

const createMockState = () => ({
  chats: clone(initialChats),
  messagesByChat: clone(initialMessages),
  invitesByTarget: {
    'group:group-chat-1': [
      makeInvite({ _id: 'invite-active-1', targetType: 'group', targetId: 'group-chat-1', state: 'active', maxUses: 5, useCount: 1 }),
      makeInvite({ _id: 'invite-revoked-1', targetType: 'group', targetId: 'group-chat-1', state: 'revoked', maxUses: null, useCount: 0, revokedAt: '2026-06-30T09:15:00.000Z' }),
    ],
    'space:space-1': [
      makeInvite({ _id: 'space-invite-1', targetType: 'space', targetId: 'space-1', state: 'active', maxUses: 10, useCount: 2 }),
    ],
  },
  createdInviteCount: 0,
});

const makeMockSpace = (state) => {
  const channel = state.chats.find((chat) => chat._id === 'space-chat-1');

  return {
    _id: 'space-1',
    name: 'Release operations',
    description: 'Private release coordination',
    owner: requester._id,
    requesterRole: 'owner',
    canManage: true,
    members: [
      { userId: requester._id, user: requester, role: 'owner', joinedAt: createdAt },
      { userId: grace._id, user: grace, role: 'member', joinedAt: createdAt },
      { userId: alan._id, user: alan, role: 'member', joinedAt: createdAt },
    ],
    memberCount: 3,
    defaultChannel: 'space-chat-1',
    defaultChannelId: 'space-chat-1',
    channels: channel ? [channel] : [],
    joinCode: 'REL12345',
    createdAt,
    updatedAt: createdAt,
  };
};

const parseJsonBody = (request) => {
  try {
    return request.postDataJSON();
  } catch {
    return {};
  }
};

const getInviteTargetFromPath = (pathname) => {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[1] !== 'invite') {
    return null;
  }
  if (parts[2] === 'group') {
    return { targetType: 'group', targetId: parts[3] };
  }
  if (parts[2] === 'space') {
    return { targetType: 'space', targetId: parts[3] };
  }
  return null;
};

const getInvitesForTarget = (state, targetType, targetId) => (
  state.invitesByTarget[`${targetType}:${targetId}`] ?? []
);

const setInvitesForTarget = (state, targetType, targetId, invites) => {
  state.invitesByTarget[`${targetType}:${targetId}`] = invites;
};

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
      await json(route, { token: true });
      return;
    }
    if (pathname === '/api/auth/refresh-token') {
      await json(route, { status: 'success' });
      return;
    }
    if (pathname === '/api/user/get-logged-user') {
      await json(route, { status: 'success', user: requester });
      return;
    }
    if (pathname === '/api/auth/2fa/status') {
      await json(route, { status: 'success', data: { twoFactor: { enabled: false, available: true, backupCodesRemaining: 0, pendingSetup: false } } });
      return;
    }
    if (pathname === '/api/auth/sessions') {
      await json(route, { status: 'success', data: { sessions: [] } });
      return;
    }
    if (pathname === '/api/user/notification-preferences') {
      await json(route, { status: 'success', data: { preferences: notificationPreferences } });
      return;
    }
    if (pathname === '/api/user/privacy/summary') {
      await json(route, { status: 'success', data: { deletionRequest: null, retentionSummary: {} } });
      return;
    }
    if (pathname === '/api/moderation/my-enforcements') {
      await json(route, { status: 'success', data: { enforcements: [] } });
      return;
    }
    if (pathname === '/api/chat/get-all-chats') {
      await json(route, { status: 'success', data: { chats: state.chats } });
      return;
    }
    if (pathname === '/api/chat/contact-requests') {
      await json(route, { status: 'success', data: { incoming: [], outgoing: [] } });
      return;
    }
    if (pathname === '/api/user/get-all-users') {
      await json(route, { status: 'success', users: [grace, alan] });
      return;
    }
    if (pathname === '/api/user/online-users') {
      await json(route, { status: 'success', data: { onlineUsers: [], allContacts: [grace, alan] } });
      return;
    }
    if (pathname === '/api/space') {
      await json(route, { status: 'success', data: { spaces: [makeMockSpace(state)] } });
      return;
    }
    if (pathname === '/api/space/space-1/channels') {
      const channel = state.chats.find((chat) => chat._id === 'space-chat-1');
      await json(route, { status: 'success', data: { channels: channel ? [channel] : [] } });
      return;
    }
    if (pathname.startsWith('/api/message/get-all-messages/')) {
      const chatId = decodeURIComponent(pathname.split('/').pop() ?? '');
      await json(route, {
        status: 'success',
        data: {
          messages: state.messagesByChat[chatId] ?? [],
          pagination: { currentPage: 1, totalPages: 1, totalMessages: state.messagesByChat[chatId]?.length ?? 0, hasMore: false, limit: 50, nextCursor: null },
          cursor: { nextCursor: null, hasMore: false, limit: 50 },
          nextCursor: null,
          hasMore: false,
        },
      });
      return;
    }
    if (pathname === '/api/message/batch/unread-counts') {
      await json(route, { status: 'success', data: { counts: {} } });
      return;
    }
    if (/^\/api\/message\/[^/]+\/shared-assets$/.test(pathname)) {
      await json(route, { status: 'success', data: { assets: [], sharedAssets: [], cursor: { nextCursor: null, hasMore: false, limit: 50 }, nextCursor: null, hasMore: false } });
      return;
    }
    if (/^\/api\/message\/[^/]+\/pinned$/.test(pathname)) {
      await json(route, { status: 'success', data: { pinnedMessages: [], messages: [], limit: 20 } });
      return;
    }

    const inviteTarget = getInviteTargetFromPath(pathname);
    if (inviteTarget && request.method() === 'GET') {
      await json(route, { status: 'success', data: { invites: getInvitesForTarget(state, inviteTarget.targetType, inviteTarget.targetId) } });
      return;
    }
    if (inviteTarget && request.method() === 'POST') {
      const body = parseJsonBody(request);
      state.createdInviteCount += 1;
      const invite = makeInvite({
        _id: `${inviteTarget.targetType}-created-${state.createdInviteCount}`,
        targetType: inviteTarget.targetType,
        targetId: inviteTarget.targetId,
        maxUses: body.maxUses === 'unlimited' ? null : body.maxUses,
        useCount: 0,
        state: 'active',
      });
      const nextInvites = [invite, ...getInvitesForTarget(state, inviteTarget.targetType, inviteTarget.targetId)];
      setInvitesForTarget(state, inviteTarget.targetType, inviteTarget.targetId, nextInvites);
      inviteActions.push({ action: 'create', target: inviteTarget, payload: body });
      await json(route, {
        status: 'success',
        data: {
          invite,
          inviteUrl: `${baseUrl}/invite/redacted-test-token-${state.createdInviteCount}`,
        },
      }, 201);
      return;
    }
    if (/^\/api\/invite\/[^/]+$/.test(pathname) && request.method() === 'DELETE') {
      const inviteId = decodeURIComponent(pathname.split('/').pop() ?? '');
      let revokedInvite = null;
      for (const [key, invites] of Object.entries(state.invitesByTarget)) {
        const nextInvites = invites.map((invite) => {
          if (invite._id !== inviteId) {
            return invite;
          }
          revokedInvite = { ...invite, state: 'revoked', revokedAt: '2026-06-30T09:30:00.000Z' };
          return revokedInvite;
        });
        state.invitesByTarget[key] = nextInvites;
      }
      inviteActions.push({ action: 'revoke', inviteId });
      await json(route, { status: 'success', data: { invite: revokedInvite } });
      return;
    }
    if (pathname.startsWith('/api/invite/join/') && request.method() === 'POST') {
      const token = decodeURIComponent(pathname.split('/').pop() ?? '');
      inviteActions.push({ action: 'join', token: token.replace(/token.*/, 'token-redacted') });
      if (token.includes('space')) {
        await json(route, { status: 'success', data: { targetType: 'space', alreadyMember: false, space: makeMockSpace(state) } });
        return;
      }
      await json(route, { status: 'success', data: { targetType: 'group', alreadyMember: false, chat: state.chats.find((chat) => chat._id === 'group-chat-1') } });
      return;
    }

    unknownApiRequests.push({ method: request.method(), url: request.url() });
    await json(route, { status: 'success', data: {} });
  });
};

const seedSelectedChat = async (context, chatId) => {
  await context.addInitScript((selectedChatId) => {
    window.localStorage.setItem('chatify_selected_chat_user-1', selectedChatId);
  }, chatId);
};

const snapshot = async (page, name, fullPage = false) => {
  const filePath = path.join(screenshotsDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage });
  assertions.push({ label: `screenshot:${name}`, path: filePath, fullPage });
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

const checkBoxInsideViewport = async (locator, label) => {
  const box = await locator.boundingBox();
  const viewport = locator.page().viewportSize();
  if (!box || !viewport) {
    throw new Error(`${label} missing visible box or viewport`);
  }
  assertions.push({ label, box, viewport });
  if (box.x < -1 || box.y < -1 || box.x + box.width > viewport.width + 1 || box.y + box.height > viewport.height + 1) {
    throw new Error(`${label} escapes viewport: ${JSON.stringify({ box, viewport })}`);
  }
};

const openMoreMenu = async (page) => {
  await page.getByTestId('conversation-pane').getByRole('button', { name: 'More conversation actions' }).click();
  await expect(page.getByRole('menu', { name: 'Conversation actions' })).toBeVisible();
};

const openInviteDialog = async (page) => {
  await openMoreMenu(page);
  await page.getByRole('menuitem', { name: 'Invite links' }).click();
  await expect(page.getByRole('dialog', { name: 'Invite links' })).toBeVisible();
};

const browser = await chromium.launch({ headless: true });
let status = 'passed';
let errorSummary = null;

try {
  const desktopContext = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
    permissions: ['clipboard-write'],
  });
  await seedSelectedChat(desktopContext, 'group-chat-1');
  await desktopContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const desktop = await desktopContext.newPage();
  await installMocks(desktop, createMockState());
  await desktop.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await expect(desktop.getByTestId('chat-shell')).toBeVisible({ timeout: 15000 });
  await expect(desktop.getByTestId('conversation-pane').getByRole('heading', { name: 'Security working group' })).toBeVisible();
  await snapshot(desktop, 'desktop-group-before');

  await openInviteDialog(desktop);
  await expect(desktop.getByText('Product group')).toHaveCount(0);
  await expect(desktop.getByText('Security working group - group')).toBeVisible();
  await expect(desktop.getByText('Active').first()).toBeVisible();
  await expect(desktop.getByText('Revoked').first()).toBeVisible();
  await expect(desktop.getByText('The full token is shown only once after creation.')).toBeVisible();
  await checkBoxInsideViewport(desktop.getByRole('dialog', { name: 'Invite links' }), 'desktop invite dialog');
  await checkNoHorizontalOverflow(desktop, 'desktop invite dialog');
  await snapshot(desktop, 'desktop-group-invite-dialog');
  await snapshot(desktop, 'desktop-group-invite-dialog-full', true);

  await desktop.getByRole('button', { name: '30 days' }).click();
  await desktop.getByRole('button', { name: '10 uses' }).click();
  await desktop.getByRole('button', { name: 'Create invite link' }).click();
  await expect(desktop.getByText(/redacted-test-token-1/)).toBeVisible();
  await desktop.getByRole('button', { name: 'Copy' }).click();
  await expect(desktop.getByRole('button', { name: 'Copied' })).toBeVisible();
  await desktop.getByRole('button', { name: 'Revoke invite link' }).first().click();
  await expect(desktop.getByText('Revoke this invite link?')).toBeVisible();
  await snapshot(desktop, 'desktop-group-invite-revoke-confirmation');
  await desktop.getByRole('button', { name: 'Confirm revoke' }).click();
  await expect(desktop.getByText('Revoked').first()).toBeVisible();
  await snapshot(desktop, 'desktop-group-invite-created-revoked');

  await desktop.getByRole('dialog', { name: 'Invite links' }).getByRole('button', { name: 'Close invite links dialog' }).click();
  await desktop.getByRole('button', { name: /Grace Hopper/ }).first().click();
  await openMoreMenu(desktop);
  await expect(desktop.getByRole('menuitem', { name: 'Invite links' })).toHaveCount(0);
  await snapshot(desktop, 'desktop-direct-no-invite-menu-item');
  await desktopContext.tracing.stop({ path: path.join(tracesDir, 'desktop-invite-links.zip') });
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  await seedSelectedChat(mobileContext, 'group-chat-1');
  await mobileContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const mobile = await mobileContext.newPage();
  await installMocks(mobile, createMockState());
  await mobile.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await expect(mobile.getByTestId('conversation-pane').getByRole('heading', { name: 'Security working group' })).toBeVisible({ timeout: 15000 });
  await openInviteDialog(mobile);
  await expect(mobile.getByRole('dialog', { name: 'Invite links' })).toBeVisible();
  await checkBoxInsideViewport(mobile.getByRole('dialog', { name: 'Invite links' }), 'mobile invite dialog');
  await checkNoHorizontalOverflow(mobile, 'mobile invite dialog');
  await snapshot(mobile, 'mobile-group-invite-dialog', true);
  await mobileContext.tracing.stop({ path: path.join(tracesDir, 'mobile-invite-links.zip') });
  await mobileContext.close();

  const tabletContext = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 });
  await seedSelectedChat(tabletContext, 'space-chat-1');
  await tabletContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const tablet = await tabletContext.newPage();
  await installMocks(tablet, createMockState());
  await tablet.goto(`${baseUrl}/?workspace=spaces&spaceId=space-1&chatId=space-chat-1`, { waitUntil: 'domcontentloaded' });
  await expect(tablet.getByTestId('conversation-pane').getByRole('heading', { name: 'release-ops' })).toBeVisible({ timeout: 15000 });
  await openInviteDialog(tablet);
  await expect(tablet.getByText('Release operations - space')).toBeVisible();
  await tablet.getByRole('button', { name: 'Create invite link' }).click();
  await expect(tablet.getByText(/redacted-test-token-1/)).toBeVisible();
  await checkNoHorizontalOverflow(tablet, 'tablet space invite dialog');
  await snapshot(tablet, 'tablet-space-invite-dialog', true);
  await tabletContext.tracing.stop({ path: path.join(tracesDir, 'tablet-space-invite-links.zip') });
  await tabletContext.close();

  const joinContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await joinContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const joinPage = await joinContext.newPage();
  await installMocks(joinPage, createMockState());
  await joinPage.goto(`${baseUrl}/invite/mock-group-token`, { waitUntil: 'domcontentloaded' });
  await expect(joinPage).toHaveURL(/chatId=group-chat-1/, { timeout: 15000 });
  await expect(joinPage.getByTestId('conversation-pane').getByRole('heading', { name: 'Security working group' })).toBeVisible();
  await snapshot(joinPage, 'desktop-invite-join-group-redirect');
  await joinPage.goto(`${baseUrl}/invite/mock-space-token`, { waitUntil: 'domcontentloaded' });
  await expect(joinPage).toHaveURL(/workspace=spaces/, { timeout: 15000 });
  await expect(joinPage).toHaveURL(/chatId=space-chat-1/);
  await expect(joinPage.getByTestId('conversation-pane').getByRole('heading', { name: 'release-ops' })).toBeVisible();
  await snapshot(joinPage, 'desktop-invite-join-space-redirect');
  await joinContext.tracing.stop({ path: path.join(tracesDir, 'desktop-invite-join.zip') });
  await joinContext.close();
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
    inviteActions,
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
    '# Phase 47 Visual QA Coverage',
    '',
    '- Mode: fallback Playwright visual QA (Hercules artifact contract; no Hercules runner available in this environment).',
    `- Base URL: ${baseUrl}`,
    '- Viewports: desktop 1366x768, mobile 390x844, tablet 768x1024.',
    '- Identity: local Vite Chatify app with mocked authenticated user Ada Lovelace and test-only group/direct/space conversations.',
    '- Covered: group admin invite list/create/copy/revoke, direct-chat no-invite boundary, mobile invite dialog layout, space manager invite dialog, protected group invite join redirect, protected space invite join redirect.',
    '- Invite URLs in screenshots use redacted test tokens and no live credentials.',
    `- Expected socket failures: ${expectedSocketFailures} (backend Socket.IO not part of this mocked UI harness).`,
    `- Unexpected network failures: ${unexpectedNetworkFailures.length}.`,
    `- Unknown API requests fulfilled with generic success: ${unknownApiRequests.length}.`,
    `- Status: ${status}.`,
    '',
  ].join('\n'));
}
