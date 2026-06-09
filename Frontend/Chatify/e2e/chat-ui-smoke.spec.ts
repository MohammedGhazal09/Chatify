import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

const currentUser = {
  _id: 'user-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  profilePic: '',
};

const otherUser = {
  _id: 'user-2',
  firstName: 'Grace',
  lastName: 'Hopper',
  email: 'grace@example.com',
  profilePic: '',
};

const messages = [
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

const chat = {
  _id: 'chat-1',
  members: [currentUser, otherUser],
  unReadMessages: 2,
  isGroupChat: false,
  latestMessage: messages[1],
  createdAt: '2026-06-09T07:55:00.000Z',
  updatedAt: '2026-06-09T08:04:00.000Z',
};

const smokeArtifactPath = (fileName: string) => path.resolve(
  process.cwd(),
  '../../.planning/phases/04-messenger-ui-reconstruction',
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
  await page.route('**/api/chat/get-all-chats', (route) => fulfillJson(route, { status: 'success', data: { chats: [chat] } }));
  await page.route('**/api/message/get-all-messages/chat-1**', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      messages,
      cursor: { nextCursor: null, hasMore: false, limit: 50 },
    },
  }));
  await page.route('**/api/message/batch/unread-counts', (route) => fulfillJson(route, {
    status: 'success',
    data: { counts: { 'chat-1': 2 } },
  }));
  await page.route('**/api/message/chat-1/mark-read', (route) => fulfillJson(route, {
    status: 'success',
    data: { unreadCount: 0, receipts: [] },
  }));
};

test('desktop authenticated messenger visual smoke', async ({ page }) => {
  await mockChatifyApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Grace Hopper' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Write a message' })).toBeVisible();
  await expect(page.getByText('This failed message fixture keeps retry controls visible.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open message actions' }).first()).toBeVisible();
  await page.screenshot({ path: smokeArtifactPath('04-ui-smoke-desktop.png') });
});

test('mobile authenticated messenger visual smoke', async ({ page }) => {
  await mockChatifyApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Grace Hopper' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Write a message' })).toBeVisible();
  await expect(page.getByText('This failed message fixture keeps retry controls visible.')).toBeVisible();
  await page.getByRole('button', { name: 'Open conversations' }).click();
  await expect(page.getByRole('button', { name: /Grace Hopper/ })).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: smokeArtifactPath('04-ui-smoke-mobile-drawer.png') });
  await page.getByRole('button', { name: 'Close conversations' }).click();
  await page.waitForTimeout(400);
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  await page.screenshot({ path: smokeArtifactPath('04-ui-smoke-mobile.png') });
});
