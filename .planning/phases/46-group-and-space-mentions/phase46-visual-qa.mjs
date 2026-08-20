import { chromium, expect } from 'file:///D:/Projects/Chatify/Frontend/Chatify/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const artifactRoot = process.argv[2];
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:5178';

if (!artifactRoot) {
  throw new Error('Usage: node phase46-visual-qa.mjs <artifactRoot> [baseUrl]');
}

const screenshotsDir = path.join(artifactRoot, 'screenshots');
const tracesDir = path.join(artifactRoot, 'traces');
const logsDir = path.join(artifactRoot, 'logs');
await mkdir(screenshotsDir, { recursive: true });
await mkdir(tracesDir, { recursive: true });
await mkdir(logsDir, { recursive: true });

const createdAt = '2026-06-30T08:20:00.000Z';
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
const katherine = {
  _id: 'user-3',
  firstName: 'Katherine',
  lastName: 'Johnson',
  username: 'katherine.johnson',
  authProvider: 'local',
  isVerified: true,
};
const alan = {
  _id: 'user-4',
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
  createdAt,
  updatedAt: createdAt,
};

const makeMessage = (overrides) => ({
  ...messageDefaults,
  ...overrides,
});

const initialMessages = {
  'group-chat-1': [
    makeMessage({
      _id: 'message-group-1',
      chatId: 'group-chat-1',
      sender: grace._id,
      text: 'Ada, can you review @ada.lovelace before launch?',
      mentions: [{
        userId: requester._id,
        username: requester.username,
        displayName: 'Ada Lovelace',
      }],
    }),
  ],
  'direct-chat-1': [
    makeMessage({
      _id: 'message-direct-1',
      chatId: 'direct-chat-1',
      sender: grace._id,
      text: 'Direct chat keeps raw @names as plain text.',
      mentions: [],
    }),
  ],
  'space-chat-1': [
    makeMessage({
      _id: 'message-space-1',
      chatId: 'space-chat-1',
      sender: katherine._id,
      text: 'Loop @ada.lovelace into the release channel.',
      mentions: [{
        userId: requester._id,
        username: requester.username,
        displayName: 'Ada Lovelace',
      }],
    }),
  ],
};

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

const initialChats = [
  makeChat({
    _id: 'group-chat-1',
    chatName: 'Security working group',
    members: [requester, grace, katherine, alan],
    isGroupChat: true,
    latestMessage: initialMessages['group-chat-1'][0],
  }),
  makeChat({
    _id: 'direct-chat-1',
    members: [requester, grace],
    isGroupChat: false,
    latestMessage: initialMessages['direct-chat-1'][0],
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
    _id: 'space-chat-1',
    chatName: 'Release operations',
    channelName: 'release-ops',
    isSpaceChannel: true,
    spaceId: 'space-1',
    members: [requester, grace, katherine],
    isGroupChat: true,
    latestMessage: initialMessages['space-chat-1'][0],
  }),
];

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
const sendRequests = [];

const json = async (route, body, status = 200, headers = {}) => route.fulfill({
  status,
  contentType: 'application/json',
  headers,
  body: JSON.stringify(body),
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const createMockState = (selectedChatId) => ({
  chats: clone(initialChats),
  messagesByChat: clone(initialMessages),
  selectedChatId,
  sentMessageCount: 0,
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
      { userId: katherine._id, user: katherine, role: 'member', joinedAt: createdAt },
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

const parseJsonBody = (request) => {
  try {
    return request.postDataJSON();
  } catch {
    const raw = request.postData();
    if (!raw) {
      return {};
    }

    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
};

const createMessageResponse = (state, body) => {
  const chatId = body.chatId;
  const chat = state.chats.find((candidate) => candidate._id === chatId);
  if (!chat) {
    return null;
  }

  const mentionUserIds = Array.isArray(body.mentionUserIds) ? body.mentionUserIds : [];
  const mentions = mentionUserIds.map((userId) => {
    const member = chat.members.find((candidate) => candidate._id === userId);
    if (!member?.username) {
      return null;
    }

    return {
      userId,
      username: member.username,
      displayName: `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim() || member.username,
    };
  }).filter(Boolean);
  const now = new Date(Date.parse(createdAt) + ((state.sentMessageCount + 1) * 1000)).toISOString();
  state.sentMessageCount += 1;

  const message = makeMessage({
    _id: `sent-message-${state.sentMessageCount}`,
    clientMessageId: body.clientMessageId ?? `client-${state.sentMessageCount}`,
    chatId,
    sender: requester._id,
    text: body.text ?? '',
    status: 'sent',
    read: false,
    deliveredAt: null,
    readAt: null,
    readBy: [],
    mentions,
    createdAt: now,
    updatedAt: now,
  });

  state.messagesByChat[chatId] = [...(state.messagesByChat[chatId] ?? []), message];
  chat.latestMessage = message;
  chat.updatedAt = now;
  return message;
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
      await json(route, {
        status: 'success',
        data: {
          twoFactor: {
            enabled: false,
            available: true,
            backupCodesRemaining: 0,
            pendingSetup: false,
          },
        },
      });
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
      await json(route, { status: 'success', data: { chats: state.chats } });
      return;
    }
    if (pathname === '/api/chat/contact-requests') {
      await json(route, { status: 'success', data: { incoming: [], outgoing: [] } });
      return;
    }
    if (pathname === '/api/user/get-all-users') {
      await json(route, { status: 'success', users: [grace, katherine, alan] });
      return;
    }
    if (pathname === '/api/user/online-users') {
      await json(route, {
        status: 'success',
        data: {
          onlineUsers: [
            { ...grace, isOnline: true, isCallReachable: true },
            { ...katherine, isOnline: true, isCallReachable: true },
          ],
          allContacts: [
            { ...grace, isOnline: true, isCallReachable: true, lastSeen: createdAt },
            { ...katherine, isOnline: true, isCallReachable: true, lastSeen: createdAt },
            { ...alan, isOnline: false, isCallReachable: false, lastSeen: createdAt },
          ],
        },
      });
      return;
    }
    if (pathname.startsWith('/api/user/online-status/')) {
      await json(route, { status: 'success', data: { isOnline: true, isCallReachable: true } });
      return;
    }
    if (pathname === '/api/space') {
      await json(route, { status: 'success', data: { spaces: [makeMockSpace(state)] } });
      return;
    }
    if (pathname === '/api/space/space-1') {
      await json(route, { status: 'success', data: { space: makeMockSpace(state) } });
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
    if (pathname === '/api/message/new-message' && request.method() === 'POST') {
      const body = parseJsonBody(request);
      sendRequests.push({ body, url: request.url() });
      const message = createMessageResponse(state, body);
      if (!message) {
        await json(route, { status: 'fail', message: 'Chat not found' }, 404);
        return;
      }
      await json(route, { status: 'success', data: { message } });
      return;
    }
    if (pathname === '/api/message/batch/unread-counts') {
      await json(route, { status: 'success', data: { counts: { 'group-chat-1': 0, 'direct-chat-1': 0, 'space-chat-1': 0 } } });
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

const seedSelectedChat = async (context, chatId) => {
  await context.addInitScript((selectedChatId) => {
    window.localStorage.setItem('chatify_selected_chat_user-1', selectedChatId);
  }, chatId);
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
  if (!box) {
    throw new Error(`${label} did not resolve to a visible box`);
  }
  const viewport = locator.page().viewportSize();
  if (!viewport) {
    throw new Error(`${label} missing viewport`);
  }
  assertions.push({ label: `${label} bounding box`, box, viewport });
  if (box.x < -1 || box.y < -1 || box.x + box.width > viewport.width + 1 || box.y + box.height > viewport.height + 1) {
    throw new Error(`${label} escapes viewport: ${JSON.stringify({ box, viewport })}`);
  }
};

const snapshot = async (page, name, fullPage = false) => {
  const filePath = path.join(screenshotsDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage });
  assertions.push({ label: `screenshot:${name}`, path: filePath, fullPage });
};

const openChat = async (page, label) => {
  await expect(page.getByTestId('chat-shell')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: label })).toBeVisible({ timeout: 15000 });
};

const getComposer = (page) => page.getByRole('textbox', { name: 'Write a private message' });

const browser = await chromium.launch({ headless: true });
let status = 'passed';
let errorSummary = null;

try {
  const desktopContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  await seedSelectedChat(desktopContext, 'group-chat-1');
  await desktopContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const desktop = await desktopContext.newPage();
  await installMocks(desktop, createMockState('group-chat-1'));
  await desktop.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await openChat(desktop, 'Security working group');
  await expect(desktop.locator('[data-mentioned-user="user-1"]').first()).toBeVisible();
  await checkNoHorizontalOverflow(desktop, 'desktop group initial');
  await snapshot(desktop, 'desktop-group-initial');
  await snapshot(desktop, 'desktop-group-initial-full', true);

  const desktopComposer = getComposer(desktop);
  await desktopComposer.fill('Thanks @gra');
  const groupSuggestions = desktop.getByRole('listbox', { name: 'Mention members' });
  await expect(groupSuggestions).toBeVisible();
  await expect(groupSuggestions.getByRole('option').filter({ hasText: '@grace.hopper' })).toBeVisible();
  await expect(groupSuggestions.getByText('Group member').first()).toBeVisible();
  await checkBoxInsideViewport(groupSuggestions, 'desktop group mention suggestions');
  await checkNoHorizontalOverflow(desktop, 'desktop group mention suggestions');
  await snapshot(desktop, 'desktop-group-mention-suggestions');
  await groupSuggestions.getByRole('option').filter({ hasText: '@grace.hopper' }).click();
  await expect(desktopComposer).toHaveValue('Thanks @grace.hopper ');
  await snapshot(desktop, 'desktop-group-mention-inserted');
  await desktop.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => sendRequests.length, { timeout: 5000 }).toBe(1);
  expect(sendRequests[0].body.mentionUserIds).toEqual([grace._id]);
  await expect(desktop.locator('[data-mentioned-user="user-2"]').last()).toBeVisible();
  await snapshot(desktop, 'desktop-group-after-send');

  await desktopComposer.fill('Loop @kat');
  await expect(groupSuggestions.getByRole('option').filter({ hasText: '@katherine.johnson' })).toBeVisible();
  await desktopComposer.press('Enter');
  await expect(desktopComposer).toHaveValue('Loop @katherine.johnson ');
  expect(sendRequests.length).toBe(1);
  await snapshot(desktop, 'desktop-group-keyboard-mention-inserted');

  await desktop.getByRole('button', { name: /Grace Hopper/ }).first().click();
  await openChat(desktop, 'Grace Hopper');
  const directComposer = getComposer(desktop);
  await directComposer.fill('@kat');
  await expect(desktop.getByRole('listbox', { name: 'Mention members' })).toHaveCount(0);
  await checkNoHorizontalOverflow(desktop, 'desktop direct raw mention');
  await snapshot(desktop, 'desktop-direct-no-mention-suggestions');
  await desktopContext.tracing.stop({ path: path.join(tracesDir, 'desktop-mentions.zip') });
  await desktopContext.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 2 });
  await seedSelectedChat(mobileContext, 'space-chat-1');
  await mobileContext.tracing.start({ screenshots: true, snapshots: true, sources: false });
  const mobile = await mobileContext.newPage();
  await installMocks(mobile, createMockState('space-chat-1'));
  await mobile.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await openChat(mobile, 'release-ops');
  await expect(mobile.locator('[data-mentioned-user="user-1"]').first()).toBeVisible();
  const mobileComposer = getComposer(mobile);
  await mobileComposer.fill('Routing to @kat');
  const mobileSuggestions = mobile.getByRole('listbox', { name: 'Mention members' });
  await expect(mobileSuggestions).toBeVisible();
  await expect(mobileSuggestions.getByRole('option').filter({ hasText: '@katherine.johnson' })).toBeVisible();
  await expect(mobileSuggestions.getByText('Space member').first()).toBeVisible();
  await checkBoxInsideViewport(mobileSuggestions, 'mobile space mention suggestions');
  await checkNoHorizontalOverflow(mobile, 'mobile space mention suggestions');
  await snapshot(mobile, 'mobile-space-mention-suggestions', true);
  await mobileSuggestions.getByRole('option').filter({ hasText: '@katherine.johnson' }).click();
  await expect(mobileComposer).toHaveValue('Routing to @katherine.johnson ');
  await mobile.getByRole('button', { name: 'Send message' }).click();
  await expect.poll(() => sendRequests.length, { timeout: 5000 }).toBe(2);
  expect(sendRequests[1].body.mentionUserIds).toEqual([katherine._id]);
  await expect(mobile.locator('[data-mentioned-user="user-3"]').last()).toBeVisible();
  await checkNoHorizontalOverflow(mobile, 'mobile space after send');
  await snapshot(mobile, 'mobile-space-after-send', true);
  await mobileContext.tracing.stop({ path: path.join(tracesDir, 'mobile-space-mentions.zip') });
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
    sendRequests: sendRequests.map((request) => ({
      chatId: request.body.chatId,
      text: request.body.text,
      mentionUserIds: request.body.mentionUserIds ?? [],
    })),
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
    '# Phase 46 Visual QA Coverage',
    '',
    '- Mode: fallback Playwright visual QA (Hercules artifact contract; no Hercules runner available in this environment).',
    `- Base URL: ${baseUrl}`,
    '- Viewports: desktop 1366x768, mobile 390x844.',
    '- Identity: local Vite Chatify app with mocked authenticated user Ada Lovelace and test-only group/direct/space conversations.',
    '- Covered: persisted current-user mention highlight, group mention suggestions, click insertion, send payload metadata, keyboard Enter insertion, direct-chat no-suggestion boundary, mobile space-channel suggestions, and mobile send metadata.',
    '- Screenshots: desktop-group-initial, desktop-group-initial-full, desktop-group-mention-suggestions, desktop-group-mention-inserted, desktop-group-after-send, desktop-group-keyboard-mention-inserted, desktop-direct-no-mention-suggestions, mobile-space-mention-suggestions, mobile-space-after-send.',
    `- Expected socket failures: ${expectedSocketFailures} (backend Socket.IO not part of this mocked UI harness).`,
    `- Unexpected network failures: ${unexpectedNetworkFailures.length}.`,
    `- Unknown API requests fulfilled with generic success: ${unknownApiRequests.length}.`,
    `- Status: ${status}.`,
    '',
  ].join('\n'));
}
