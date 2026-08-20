import path from 'node:path';
import { Buffer } from 'node:buffer';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { Message, SavedMessage } from '../src/types/chat';
import { makeMessage } from '../src/test/chatFixtures';
import {
  PHASE06_SELECTED_CHAT_ID,
  phase06VisualFixture,
} from './fixtures/phase06VisualFixture';

const artifactRoot = process.env.HERCULES_ARTIFACT_DIR
  ?? path.resolve(process.cwd(), '../../.planning/phases/48-saved-messages-and-bookmarks/visual-qa');

const screenshotPath = (fileName: string) => path.join(artifactRoot, 'screenshots', fileName);

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

const selectedChat = phase06VisualFixture.chats.find((chat) => chat._id === PHASE06_SELECTED_CHAT_ID);

if (!selectedChat) {
  throw new Error('Phase48 saved-message fixture requires the selected chat.');
}

const savedAt = '2026-06-30T12:00:00.000Z';
const savedMessage = {
  ...phase06VisualFixture.messagesByChatId[PHASE06_SELECTED_CHAT_ID][0],
  savedByRequester: true,
  savedAt,
} as Message;
const encryptedSavedMessage = makeMessage({
  _id: 'phase48-message-encrypted-saved',
  chatId: PHASE06_SELECTED_CHAT_ID,
  sender: phase06VisualFixture.currentUser._id,
  text: 'private plaintext marker',
  messageType: 'encrypted',
  encryptionMode: 'e2ee_v1',
  savedByRequester: true,
  savedAt,
  createdAt: '2025-05-12T09:35:00.000Z',
  updatedAt: '2025-05-12T09:35:00.000Z',
});

const createSavedEntry = (message: Message): SavedMessage => ({
  _id: `saved-${message._id}`,
  messageId: message._id,
  chatId: message.chatId,
  savedAt: message.savedAt ?? savedAt,
  savedByRequester: true,
  chat: selectedChat,
  message,
});

const createPresenceSnapshot = () => {
  const presenceByUserId = new Map(phase06VisualFixture.presence.map((status) => [status.userId, status]));
  const allContacts = phase06VisualFixture.users
    .filter((user) => user._id !== phase06VisualFixture.currentUser._id)
    .map((user) => {
      const status = presenceByUserId.get(user._id);

      return {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePic: user.profilePic,
        isOnline: status?.isOnline ?? false,
        isCallReachable: status?.isCallReachable ?? status?.isOnline ?? false,
        lastSeen: status?.lastSeen,
      };
    });

  return {
    status: 'success',
    data: {
      onlineUsers: allContacts.filter((contact) => contact.isOnline),
      allContacts,
    },
  };
};

const getMessagesForChat = (chatId: string) => {
  if (chatId !== PHASE06_SELECTED_CHAT_ID) {
    return phase06VisualFixture.messagesByChatId[chatId] ?? [];
  }

  return [
    savedMessage,
    ...phase06VisualFixture.messagesByChatId[PHASE06_SELECTED_CHAT_ID].slice(1),
  ];
};

const mockChatifySavedApi = async (page: Page) => {
  let savedEntries = [
    createSavedEntry(savedMessage),
    createSavedEntry(encryptedSavedMessage),
  ];

  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/csrf-token', (route) => fulfillJson(route, { csrfToken: 'phase48-token' }));
  await page.route('**/api/auth/is-authenticated', (route) => fulfillJson(route, { token: true }));
  await page.route('**/api/user/get-logged-user', (route) => fulfillJson(route, { status: 'success', user: phase06VisualFixture.currentUser }));
  await page.route('**/api/user/*/profile-image**', (route) => {
    route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng });
  });
  await page.route('**/api/user/notification-preferences', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      preferences: {
        pushEnabled: false,
        emailNotificationsEnabled: false,
        messagePreviewMode: 'none',
        emailUnsubscribed: false,
        pushSubscriptionCount: 0,
        mutedChatIds: [],
      },
    },
  }));
  await page.route('**/api/user/online-users', (route) => fulfillJson(route, createPresenceSnapshot()));
  await page.route('**/api/space', (route) => fulfillJson(route, {
    status: 'success',
    data: { spaces: [] },
  }));
  await page.route('**/api/auth/logout', (route) => fulfillJson(route, { status: 'success' }));
  await page.route('**/api/chat/get-all-chats', (route) => fulfillJson(route, {
    status: 'success',
    data: { chats: phase06VisualFixture.chats },
  }));
  await page.route('**/api/message/saved', (route) => fulfillJson(route, {
    status: 'saved messages fetched successfully',
    data: {
      savedMessages: savedEntries,
      messages: savedEntries.map((entry) => entry.message),
      limit: 50,
    },
  }));
  await page.route('**/api/message/get-all-messages/**', (route) => {
    const url = new URL(route.request().url());
    const chatId = url.pathname.split('/').at(-1) ?? '';

    fulfillJson(route, {
      status: 'success',
      data: {
        messages: getMessagesForChat(chatId),
        cursor: { nextCursor: null, hasMore: false, limit: 50 },
      },
    });
  });
  await page.route('**/api/message/context/**', (route) => fulfillJson(route, {
    status: 'message context fetched successfully',
    data: {
      targetMessageId: encryptedSavedMessage._id,
      messages: [encryptedSavedMessage],
      cursor: { nextCursor: null, hasMore: false, limit: 25 },
      context: { hasMoreBefore: false, hasMoreAfter: false, limit: 25 },
    },
  }));
  await page.route('**/api/message/*/save', (route) => {
    const messageId = route.request().url().split('/').at(-2) ?? '';
    const source = getMessagesForChat(PHASE06_SELECTED_CHAT_ID).find((message) => message._id === messageId)
      ?? encryptedSavedMessage;
    const nextMessage = {
      ...source,
      savedByRequester: route.request().method() === 'POST',
      savedAt: route.request().method() === 'POST' ? savedAt : null,
    };

    if (route.request().method() === 'DELETE') {
      savedEntries = savedEntries.filter((entry) => entry.messageId !== messageId);
    } else {
      savedEntries = [
        createSavedEntry(nextMessage),
        ...savedEntries.filter((entry) => entry.messageId !== messageId),
      ];
    }

    fulfillJson(route, {
      status: nextMessage.savedByRequester ? 'message saved successfully' : 'message unsaved successfully',
      data: {
        message: nextMessage,
        savedMessage: nextMessage.savedByRequester ? createSavedEntry(nextMessage) : null,
        savedByRequester: nextMessage.savedByRequester,
      },
    });
  });
  await page.route('**/api/message/*/shared-assets**', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      assets: [],
      sharedAssets: [],
      kind: new URL(route.request().url()).searchParams.get('kind'),
      cursor: { nextCursor: null, hasMore: false, limit: 12 },
    },
  }));
  await page.route('**/api/message/*/pinned', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      pinnedMessages: phase06VisualFixture.pinnedMessages,
      limit: 20,
    },
  }));
  await page.route('**/api/message/attachments/*/preview', (route) => {
    route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng });
  });
  await page.route('**/api/message/attachments/*/download', (route) => {
    route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'download' });
  });
  await page.route('**/api/message/batch/unread-counts', (route) => fulfillJson(route, {
    status: 'success',
    data: { counts: phase06VisualFixture.unreadCounts },
  }));
  await page.route('**/api/message/*/mark-read', (route) => fulfillJson(route, {
    status: 'success',
    data: { unreadCount: 0, receipts: [] },
  }));
};

const openSavedFixture = async (page: Page, viewport: { width: number; height: number }) => {
  await page.setViewportSize(viewport);
  await mockChatifySavedApi(page);
  await page.goto(`/?chatId=${PHASE06_SELECTED_CHAT_ID}&chatTheme=light`);
  await expect(page.getByTestId('chat-root')).toHaveAttribute('data-chat-theme', 'light');
  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: phase06VisualFixture.selectedTitle })).toBeVisible();
};

test('Phase 48 saved messages desktop visual and logic smoke', async ({ page }) => {
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

  await openSavedFixture(page, { width: 1366, height: 768 });
  await expect(page.locator('[data-message-id="phase06-message-reconnect"]').getByLabel('Saved')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase48-desktop-initial.png'), fullPage: true });

  await page.getByRole('button', { name: 'Open saved messages' }).click();
  const savedDialog = page.getByRole('dialog', { name: 'Saved messages' });
  await expect(savedDialog).toBeVisible();
  await expect(savedDialog.getByText('The socket reconnect looked clean. Presence updated fast.')).toBeVisible();
  await expect(savedDialog.getByText('Encrypted message')).toBeVisible();
  await expect(savedDialog.getByText('private plaintext marker')).not.toBeVisible();
  await page.screenshot({ path: screenshotPath('phase48-desktop-saved-dialog.png'), fullPage: true });

  await page.getByRole('button', { name: 'Unsave message' }).first().click();
  await expect(page.getByText('1 saved')).toBeVisible();

  await page.getByRole('button', { name: 'Jump' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Saved messages' })).not.toBeVisible();
  await expect(page.locator('[data-message-id="phase48-message-encrypted-saved"]')).toBeVisible();

  await page.locator('[data-message-id="phase06-message-quiet"]').getByRole('button', { name: 'Open message actions' }).click();
  await expect(page.getByRole('group', { name: 'Message actions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save message' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase48-desktop-message-actions.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save message' }).click();
  await expect(page.locator('[data-message-id="phase06-message-quiet"]').getByLabel('Saved')).toBeVisible();

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('Phase 48 saved messages mobile visual smoke', async ({ page }) => {
  await openSavedFixture(page, { width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open conversations' }).click();
  await page.getByRole('button', { name: 'Open saved messages' }).click();
  await expect(page.getByRole('dialog', { name: 'Saved messages' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jump' }).first()).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase48-mobile-saved-dialog.png'), fullPage: true });
});
