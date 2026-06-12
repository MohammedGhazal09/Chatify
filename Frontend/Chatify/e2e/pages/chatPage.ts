import path from 'node:path';
import { expect, type Page, type Route } from '@playwright/test';
import {
  PHASE07_PRIMARY_CHAT_ID,
  createPhase07PersistedMessage,
  phase07BehaviorFixture,
  type CreateMessageInput,
} from '../fixtures/phase07BehaviorFixture';

export const phase07ArtifactPath = (fileName: string) => path.resolve(
  process.cwd(),
  '../../.planning/phases/07-messenger-functional-parity-restoration',
  fileName
);

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

export const installPhase07ApiMocks = async (page: Page) => {
  const messagesByChatId = new Map<string, unknown[]>(
    Object.entries(phase07BehaviorFixture.messagesByChatId).map(([chatId, messages]) => [
      chatId,
      [...messages],
    ])
  );

  await page.route('**/api/csrf-token', (route) => fulfillJson(route, { csrfToken: 'phase07-token' }));
  await page.route('**/api/auth/is-authenticated', (route) => fulfillJson(route, { token: true }));
  await page.route('**/api/user/get-logged-user', (route) => fulfillJson(route, {
    status: 'success',
    user: phase07BehaviorFixture.currentUser,
  }));
  await page.route('**/api/auth/logout', (route) => fulfillJson(route, { status: 'success' }));
  await page.route('**/api/chat/get-all-chats', (route) => fulfillJson(route, {
    status: 'success',
    data: { chats: phase07BehaviorFixture.chats },
  }));
  await page.route('**/api/chat/create-new-chat', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      chat: phase07BehaviorFixture.chats.find((chat) => chat._id === phase07BehaviorFixture.secondaryChatId),
    },
  }));
  await page.route('**/api/message/new-message', async (route) => {
    const payload = route.request().postDataJSON() as CreateMessageInput;
    const message = createPhase07PersistedMessage(payload);
    messagesByChatId.set(payload.chatId, [...(messagesByChatId.get(payload.chatId) ?? []), message]);

    fulfillJson(route, {
      status: 'success',
      data: { message },
    });
  });
  await page.route('**/api/message/get-all-messages/**', (route) => {
    const url = new URL(route.request().url());
    const chatId = url.pathname.split('/').at(-1) ?? '';

    fulfillJson(route, {
      status: 'success',
      data: {
        messages: messagesByChatId.get(chatId) ?? [],
        cursor: { nextCursor: null, hasMore: false, limit: 50 },
      },
    });
  });
  await page.route('**/api/message/*/shared-assets**', (route) => {
    const url = new URL(route.request().url());
    const kind = url.searchParams.get('kind');

    fulfillJson(route, {
      status: 'success',
      data: {
        assets: [],
        sharedAssets: [],
        kind,
        cursor: { nextCursor: null, hasMore: false, limit: 12 },
      },
    });
  });
  await page.route('**/api/message/*/pinned', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      pinnedMessages: [],
      limit: 20,
    },
  }));
  await page.route(`**/api/message/search/${PHASE07_PRIMARY_CHAT_ID}**`, (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') ?? '';

    fulfillJson(route, {
      status: 'messages searched successfully',
      data: {
        messages: query.toLowerCase().includes('live') ? phase07BehaviorFixture.searchMessages : [],
        query,
        limit: 25,
      },
    });
  });
  await page.route('**/api/message/batch/unread-counts', (route) => fulfillJson(route, {
    status: 'success',
    data: { counts: phase07BehaviorFixture.unreadCounts },
  }));
  await page.route('**/api/message/*/mark-read', (route) => fulfillJson(route, {
    status: 'success',
    data: { unreadCount: 0, receipts: [] },
  }));
};

export const openPhase07Chat = async (
  page: Page,
  {
    theme = 'light',
    chatId = phase07BehaviorFixture.selectedChatId,
  }: {
    theme?: 'light' | 'dark';
    chatId?: string;
  } = {}
) => {
  await installPhase07ApiMocks(page);
  await page.goto(`/?chatId=${chatId}&chatTheme=${theme}`);
  await expect(page.getByTestId('chat-root')).toHaveAttribute('data-chat-theme', theme, { timeout: 15000 });
};

export const expectNoHorizontalOverflow = async (page: Page) => {
  await expect.poll(async () => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
    document.body.scrollWidth <= document.body.clientWidth
  ))).toBe(true);
};

export const expectComposerDoesNotOverlapLatestMessage = async (page: Page) => {
  await page.locator('.chat-messages-scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  await expect.poll(async () => {
    const latestMessageBox = await page.locator('[data-message-id]').last().boundingBox();
    const composerBox = await page.locator('.composer-dock').boundingBox();

    if (!latestMessageBox || !composerBox) {
      return false;
    }

    return latestMessageBox.y + latestMessageBox.height <= composerBox.y + 1;
  }).toBe(true);
};

export const applyVisibleRealtimeUpdate = async (page: Page) => {
  await page.evaluate(async ({ presence, typingUsers }) => {
    const { usePresenceStore } = await import('/src/store/presenceStore.ts');
    const store = usePresenceStore.getState();

    store.replaceOnlineUsers(presence);
    typingUsers.forEach((typing) => {
      store.setUserTyping(typing.chatId, typing);
    });
  }, {
    presence: phase07BehaviorFixture.presence,
    typingUsers: phase07BehaviorFixture.typingUsers,
  });
};
