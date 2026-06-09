import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

const currentUser = {
  _id: 'user-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  profilePic: '',
};

const graceUser = {
  _id: 'user-2',
  firstName: 'Grace',
  lastName: 'Hopper',
  email: 'grace@example.com',
  profilePic: '',
};

const alanUser = {
  _id: 'user-3',
  firstName: 'Alan',
  lastName: 'Turing',
  email: 'alan@example.com',
  profilePic: '',
};

const chatOneMessages = [
  {
    _id: 'message-1',
    chatId: 'chat-1',
    sender: 'user-2',
    text: 'The transport recovery notes are ready for review.',
    read: false,
    status: 'delivered',
    reactions: [],
    createdAt: '2026-06-09T08:00:00.000Z',
    updatedAt: '2026-06-09T08:00:00.000Z',
  },
  {
    _id: 'message-2',
    chatId: 'chat-1',
    sender: 'user-1',
    text: 'Thanks. I will check the retry path before shipping.',
    read: true,
    status: 'read',
    readBy: [{ user: 'user-2', readAt: '2026-06-09T08:03:00.000Z' }],
    reactions: [],
    createdAt: '2026-06-09T08:02:00.000Z',
    updatedAt: '2026-06-09T08:02:00.000Z',
  },
  {
    _id: 'message-3',
    chatId: 'chat-1',
    sender: 'user-1',
    text: 'This failed message fixture keeps retry controls visible.',
    read: false,
    status: 'sent',
    optimisticState: 'failed',
    clientMessageId: 'client-failed-1',
    errorMessage: 'Network unavailable',
    reactions: [],
    createdAt: '2026-06-09T08:04:00.000Z',
    updatedAt: '2026-06-09T08:04:00.000Z',
  },
];

const chatTwoMessages = [
  {
    _id: 'message-4',
    chatId: 'chat-2',
    sender: 'user-3',
    text: 'Launch checklist is ready for the baseline smoke.',
    read: true,
    status: 'read',
    reactions: [],
    createdAt: '2026-06-09T08:05:00.000Z',
    updatedAt: '2026-06-09T08:05:00.000Z',
  },
];

const chatOne = {
  _id: 'chat-1',
  members: [currentUser, graceUser],
  unReadMessages: 2,
  isGroupChat: false,
  latestMessage: chatOneMessages[1],
  createdAt: '2026-06-09T07:55:00.000Z',
  updatedAt: '2026-06-09T08:06:00.000Z',
};

const chatTwo = {
  _id: 'chat-2',
  members: [currentUser, alanUser],
  unReadMessages: 0,
  isGroupChat: false,
  latestMessage: chatTwoMessages[0],
  createdAt: '2026-06-09T07:50:00.000Z',
  updatedAt: '2026-06-09T08:05:00.000Z',
};

const smokeArtifactPath = (fileName: string) => path.resolve(
  process.cwd(),
  '../../.planning/phases/05-messenger-baseline-completion',
  fileName
);

const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const mockChatifyApi = async (page: Page) => {
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/csrf-token', (route) => fulfillJson(route, { csrfToken: 'ui-smoke-token' }));
  await page.route('**/api/auth/is-authenticated', (route) => fulfillJson(route, { token: true }));
  await page.route('**/api/user/get-logged-user', (route) => fulfillJson(route, { status: 'success', user: currentUser }));
  await page.route('**/api/auth/logout', (route) => fulfillJson(route, { status: 'success' }));
  await page.route('**/api/chat/get-all-chats', (route) => fulfillJson(route, {
    status: 'success',
    data: { chats: [chatOne, chatTwo] },
  }));
  await page.route('**/api/chat/create-new-chat', (route) => fulfillJson(route, {
    status: 'success',
    data: { chat: chatTwo },
  }));
  await page.route('**/api/message/get-all-messages/chat-1**', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      messages: chatOneMessages,
      cursor: { nextCursor: null, hasMore: false, limit: 50 },
    },
  }));
  await page.route('**/api/message/get-all-messages/chat-2**', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      messages: chatTwoMessages,
      cursor: { nextCursor: null, hasMore: false, limit: 50 },
    },
  }));
  await page.route('**/api/message/search/chat-1**', (route) => fulfillJson(route, {
    status: 'messages searched successfully',
    data: {
      messages: [chatOneMessages[0]],
      query: 'recovery',
      limit: 25,
    },
  }));
  await page.route('**/api/message/batch/unread-counts', (route) => fulfillJson(route, {
    status: 'success',
    data: { counts: { 'chat-1': 2, 'chat-2': 0 } },
  }));
  await page.route('**/api/message/chat-1/mark-read', (route) => fulfillJson(route, {
    status: 'success',
    data: { unreadCount: 0, receipts: [] },
  }));
  await page.route('**/api/message/chat-2/mark-read', (route) => fulfillJson(route, {
    status: 'success',
    data: { unreadCount: 0, receipts: [] },
  }));
};

test('desktop messenger baseline search and result mode smoke', async ({ page }) => {
  await mockChatifyApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?chatId=chat-1');

  await expect(page.getByRole('heading', { name: 'Grace Hopper' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Write a message' })).toBeVisible();
  await expect(page.getByText('This failed message fixture keeps retry controls visible.')).toBeVisible();

  await page.getByRole('textbox', { name: 'Search conversations' }).fill('launch');
  await expect(page.getByRole('button', { name: /Alan Turing/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Grace Hopper/ })).not.toBeVisible();

  await page.getByRole('textbox', { name: 'Search conversations' }).fill('retry');
  await expect(page.getByRole('button', { name: /Grace Hopper/ })).toBeVisible();

  await page.getByRole('button', { name: 'Search messages' }).click();
  await page.getByRole('textbox', { name: 'Search this conversation' }).fill('recovery');
  await expect(page.getByText('1 result')).toBeVisible();
  await expect(page.getByRole('button', { name: /Jump to message from Grace Hopper .*The transport recovery notes/ })).toBeVisible();

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.getByText('This failed message fixture keeps retry controls visible.')).toBeVisible();
  await page.screenshot({ path: smokeArtifactPath('05-ui-smoke-desktop-search.png') });
});

test('mobile drawer conversation search smoke', async ({ page }) => {
  await mockChatifyApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?chatId=chat-1');

  await expect(page.getByRole('heading', { name: 'Grace Hopper' })).toBeVisible();
  await page.getByRole('button', { name: 'Open conversations' }).click();

  const drawer = page.locator('.chat-sidebar.open');
  await expect(drawer).toBeVisible();
  await expect.poll(async () => {
    const drawerBox = await drawer.boundingBox();
    return drawerBox?.x ?? -999;
  }).toBeGreaterThanOrEqual(-1);
  await expect.poll(async () => {
    const drawerBox = await drawer.boundingBox();
    return drawerBox?.x ?? 999;
  }).toBeLessThanOrEqual(1);
  await expect.poll(async () => {
    const drawerBox = await drawer.boundingBox();
    return drawerBox?.width ?? 0;
  }).toBeGreaterThan(300);
  await expect.poll(async () => {
    const drawerBox = await drawer.boundingBox();
    return drawerBox?.width ?? 999;
  }).toBeLessThanOrEqual(321);
  await expect(page.locator('.chat-overlay.show')).toBeVisible();

  await page.getByRole('textbox', { name: 'Search conversations' }).fill('launch');
  await expect(page.getByRole('button', { name: /Alan Turing/ })).toBeVisible();
  await page.screenshot({ path: smokeArtifactPath('05-ui-smoke-mobile-drawer-search.png') });
});

test('exact-email New chat continuation selects existing conversation', async ({ page }) => {
  await mockChatifyApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?chatId=chat-1');

  await page.getByRole('button', { name: 'New chat' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('alan@example.com');
  await page.getByRole('button', { name: 'Start or continue chat' }).click();

  await expect(page.getByRole('heading', { name: 'Alan Turing' })).toBeVisible();
  await expect(page.locator('section').getByText('Launch checklist is ready for the baseline smoke.')).toBeVisible();
});

test('URL selected chat restore and invalid fallback smoke', async ({ page }) => {
  await mockChatifyApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/?chatId=chat-2');
  await expect(page.getByRole('heading', { name: 'Alan Turing' })).toBeVisible();

  await page.goto('/?chatId=not-accessible');
  await expect(page.getByRole('heading', { name: 'Alan Turing' })).toBeVisible();
  await expect(page).not.toHaveURL(/not-accessible/);
});

test('auth-expired smoke hides private conversation content', async ({ page }) => {
  await mockChatifyApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/?chatId=chat-1');

  await expect(page.getByText('This failed message fixture keeps retry controls visible.')).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('chatify:auth-expired'));
  });

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('This failed message fixture keeps retry controls visible.')).not.toBeVisible();
});
