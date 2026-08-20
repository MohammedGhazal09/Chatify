import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { Chat, Message, UserOnlineStatus } from '../src/types/chat';
import { makeChat, makeMessage } from '../src/test/chatFixtures';
import {
  phase06CipherNode,
  phase06CurrentUser,
} from './fixtures/phase06VisualFixture';

const ENCRYPTED_CHAT_ID = 'phase52-chat-encrypted-recovery';
const LOCAL_SECRET_KEY = `chatify:e2ee:v1:conversation-secret:${ENCRYPTED_CHAT_ID}`;
const VALID_LOCAL_SECRET = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const artifactRoot = process.env.HERCULES_ARTIFACT_DIR
  ?? path.resolve(process.cwd(), '../../.planning/phases/52-encrypted-conversation-recovery-and-attachment-hardening');

const screenshotPath = (fileName: string) => {
  const target = path.join(artifactRoot, 'screenshots', fileName);
  mkdirSync(path.dirname(target), { recursive: true });
  return target;
};

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const encryptedMessage = makeMessage({
  _id: 'phase52-message-encrypted',
  chatId: ENCRYPTED_CHAT_ID,
  sender: phase06CipherNode._id,
  text: '',
  messageType: 'encrypted',
  encryptionMode: 'e2ee_v1',
  encryptedPayload: {
    ciphertext: 'cGhhc2U1Mi1jaXBoZXJ0ZXh0',
    iv: 'cGhhc2U1Mi1pdg==',
    algorithm: 'AES-GCM',
    keyVersion: 1,
    senderDeviceId: 'phase52-device',
    encryptedAt: '2026-07-01T05:00:00.000Z',
  },
  createdAt: '2026-07-01T05:00:00.000Z',
  updatedAt: '2026-07-01T05:00:00.000Z',
});

const encryptedChat = makeChat({
  _id: ENCRYPTED_CHAT_ID,
  members: [phase06CurrentUser, phase06CipherNode],
  encryptionMode: 'e2ee_v1',
  latestMessage: encryptedMessage,
  conversationControls: {
    isDirectChat: true,
    peerId: phase06CipherNode._id,
    canSendMessage: true,
    canBlockUser: true,
    canUnblockUser: false,
    blockedByMe: false,
    blockedMe: false,
    messagingDisabledReason: null,
  },
  createdAt: '2026-07-01T04:55:00.000Z',
  updatedAt: '2026-07-01T05:00:00.000Z',
});

const presence: UserOnlineStatus[] = [{
  userId: phase06CipherNode._id,
  userName: 'Cipher Node',
  isOnline: true,
  isCallReachable: true,
  profileStatus: 'Available for secure chat',
}];

const mockPhase52Api = async (page: Page, options: { messages?: Message[] } = {}) => {
  const chats: Chat[] = [encryptedChat];
  const messages = options.messages ?? [encryptedMessage];

  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (!pathname.startsWith('/api/')) {
      route.continue();
      return;
    }

    if (pathname.includes('/profile-image')) {
      fulfillJson(route, {}, 204);
      return;
    }

    if (pathname === '/api/csrf-token') {
      fulfillJson(route, { csrfToken: 'phase52-token' });
      return;
    }

    if (pathname === '/api/auth/is-authenticated') {
      fulfillJson(route, { token: true });
      return;
    }

    if (pathname === '/api/user/get-logged-user') {
      fulfillJson(route, { status: 'success', user: phase06CurrentUser });
      return;
    }

    if (pathname === '/api/user/get-all-users') {
      fulfillJson(route, { status: 'success', users: [phase06CipherNode] });
      return;
    }

    if (pathname === '/api/user/online-users') {
      fulfillJson(route, {
        status: 'success',
        data: {
          onlineUsers: [phase06CipherNode],
          allContacts: [phase06CipherNode],
        },
      });
      return;
    }

    if (pathname === '/api/user/notification-preferences') {
      fulfillJson(route, {
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
      });
      return;
    }

    if (pathname === '/api/space') {
      fulfillJson(route, { status: 'success', data: { spaces: [] } });
      return;
    }

    if (pathname === '/api/chat/get-all-chats') {
      fulfillJson(route, { status: 'success', data: { chats } });
      return;
    }

    if (pathname === '/api/chat/contact-requests') {
      fulfillJson(route, { status: 'success', data: { incoming: [], outgoing: [] } });
      return;
    }

    if (pathname === `/api/message/get-all-messages/${ENCRYPTED_CHAT_ID}`) {
      fulfillJson(route, {
        status: 'success',
        data: {
          messages,
          cursor: { nextCursor: null, hasMore: false, limit: 50 },
        },
      });
      return;
    }

    if (pathname === '/api/message/batch/unread-counts') {
      fulfillJson(route, { status: 'success', data: { counts: { [ENCRYPTED_CHAT_ID]: 0 } } });
      return;
    }

    if (pathname.endsWith('/mark-read')) {
      fulfillJson(route, { status: 'success', data: { unreadCount: 0, receipts: [] } });
      return;
    }

    if (pathname.endsWith('/shared-assets')) {
      fulfillJson(route, {
        status: 'success',
        data: {
          assets: [],
          sharedAssets: [],
          kind: url.searchParams.get('kind'),
          cursor: { nextCursor: null, hasMore: false, limit: 12 },
        },
      });
      return;
    }

    if (pathname.endsWith('/pinned')) {
      fulfillJson(route, {
        status: 'success',
        data: {
          pinnedMessages: [],
          limit: 20,
        },
      });
      return;
    }

    if (pathname === '/api/user/presence/snapshot') {
      fulfillJson(route, { status: 'success', data: { presence } });
      return;
    }

    fulfillJson(route, {
      status: 'error',
      message: `Unhandled Phase52 mock route: ${request.method()} ${pathname}`,
    }, 404);
  });
};

const createEvidenceCollectors = (page: Page) => {
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

  return { consoleErrors, failedRequests };
};

const openEncryptedChat = async (
  page: Page,
  viewport: { width: number; height: number },
  options: { withSecret?: boolean } = {}
) => {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ key, secret, withSecret }) => {
    window.localStorage.clear();
    if (withSecret) {
      window.localStorage.setItem(key, secret);
    }
  }, {
    key: LOCAL_SECRET_KEY,
    secret: VALID_LOCAL_SECRET,
    withSecret: options.withSecret === true,
  });
  await mockPhase52Api(page);
  await page.goto(`/?chatId=${ENCRYPTED_CHAT_ID}&chatTheme=light`);
  await expect(page.getByTestId('chat-root')).toHaveAttribute('data-chat-theme', 'light');
  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: 'Cipher Node' })).toBeVisible();
};

test('Phase 52 desktop encrypted recovery ready state visual QA', async ({ page }) => {
  const { consoleErrors, failedRequests } = createEvidenceCollectors(page);

  await openEncryptedChat(page, { width: 1366, height: 768 }, { withSecret: true });

  await expect(page.getByRole('group', { name: 'Encrypted recovery' })).toBeVisible();
  await expect(page.getByText(/Recovery key ready on this device/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy recovery key' })).toBeVisible();
  await expect(page.locator('button[aria-label="Attach file"]')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Record voice message' })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText('chatify-e2ee-v1:');
  await page.screenshot({ path: screenshotPath('phase52-desktop-recovery-ready.png'), fullPage: true });

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('Phase 52 mobile encrypted recovery import visual QA', async ({ page }) => {
  const { consoleErrors, failedRequests } = createEvidenceCollectors(page);

  await openEncryptedChat(page, { width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open conversation details' }).click();

  await expect(page.getByRole('group', { name: 'Encrypted recovery' })).toBeVisible();
  await expect(page.getByText(/This device needs the recovery key/)).toBeVisible();
  await expect(page.getByLabel('Recovery key')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import recovery key' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('chatify-e2ee-v1:');
  await page.screenshot({ path: screenshotPath('phase52-mobile-recovery-import.png'), fullPage: true });

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
