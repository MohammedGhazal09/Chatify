import path from 'node:path';
import { Buffer } from 'node:buffer';
import { expect, test, type Page, type Route } from '@playwright/test';
import {
  PHASE06_SELECTED_CHAT_ID,
  phase06VisualFixture,
} from './fixtures/phase06VisualFixture';

const chatSmokeArtifactRoot = process.env.CHATIFY_CHAT_SMOKE_ARTIFACT_DIR
  ?? path.resolve(process.cwd(), '../../.planning/phases/08-media-files-and-conversation-detail-implementation');

const phase08ArtifactPath = (fileName: string) => path.resolve(chatSmokeArtifactRoot, fileName);

const fulfillJson = (route: Route, body: unknown) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

const getMessagesForChat = (chatId: string) => {
  const messagesByChatId = phase06VisualFixture.messagesByChatId as Record<string, unknown[]>;
  return messagesByChatId[chatId] ?? [];
};

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

const mockChatifyApi = async (page: Page) => {
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/csrf-token', (route) => fulfillJson(route, { csrfToken: 'ui-smoke-token' }));
  await page.route('**/api/auth/is-authenticated', (route) => fulfillJson(route, { token: true }));
  await page.route('**/api/user/get-logged-user', (route) => fulfillJson(route, { status: 'success', user: phase06VisualFixture.currentUser }));
  await page.route('**/api/user/online-users', (route) => fulfillJson(route, createPresenceSnapshot()));
  await page.route('**/api/auth/logout', (route) => fulfillJson(route, { status: 'success' }));
  await page.route('**/api/chat/get-all-chats', (route) => fulfillJson(route, {
    status: 'success',
    data: { chats: phase06VisualFixture.chats },
  }));
  await page.route('**/api/chat/create-new-chat', (route) => fulfillJson(route, {
    status: 'success',
    data: { chat: phase06VisualFixture.chats.find((chat) => chat._id === phase06VisualFixture.secondaryChatId) },
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
  await page.route('**/api/message/*/shared-assets**', (route) => {
    const url = new URL(route.request().url());
    const kind = url.searchParams.get('kind');
    const assets = kind === 'media'
      ? phase06VisualFixture.sharedMedia
      : kind === 'file'
        ? phase06VisualFixture.sharedFiles
        : [...phase06VisualFixture.sharedFiles, ...phase06VisualFixture.sharedMedia];

    fulfillJson(route, {
      status: 'success',
      data: {
        assets,
        sharedAssets: assets,
        kind,
        cursor: { nextCursor: null, hasMore: false, limit: 12 },
      },
    });
  });
  await page.route('**/api/message/*/pinned', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      pinnedMessages: phase06VisualFixture.pinnedMessages,
      limit: 20,
    },
  }));
  await page.route('**/api/message/attachments/*/preview', (route) => {
    const isMedia = route.request().url().includes('abstract-grid');
    route.fulfill({
      status: 200,
      contentType: isMedia ? 'image/png' : 'application/pdf',
      body: isMedia ? transparentPng : 'abstract file preview',
    });
  });
  await page.route('**/api/message/attachments/*/download', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: 'abstract file download',
    });
  });
  await page.route(`**/api/message/search/${PHASE06_SELECTED_CHAT_ID}**`, (route) => fulfillJson(route, {
    status: 'messages searched successfully',
    data: {
      messages: phase06VisualFixture.searchMessages,
      query: 'state',
      limit: 25,
    },
  }));
  await page.route('**/api/message/batch/unread-counts', (route) => fulfillJson(route, {
    status: 'success',
    data: { counts: phase06VisualFixture.unreadCounts },
  }));
  await page.route('**/api/message/*/mark-read', (route) => fulfillJson(route, {
    status: 'success',
    data: { unreadCount: 0, receipts: [] },
  }));
};

const seedPhase06Presence = async (page: Page) => {
  await page.evaluate(async ({ presence, typingUsers }) => {
    const { usePresenceStore } = await import('/src/store/presenceStore.ts');
    const store = usePresenceStore.getState();

    store.replaceOnlineUsers(presence);
    typingUsers.forEach((typing) => {
      store.setUserTyping(typing.chatId, typing);
    });
  }, {
    presence: phase06VisualFixture.presence,
    typingUsers: phase06VisualFixture.typingUsers,
  });
};

const openPhase06Chat = async (page: Page, theme: 'light' | 'dark') => {
  await mockChatifyApi(page);
  await page.goto(`/?chatId=${PHASE06_SELECTED_CHAT_ID}&chatTheme=${theme}`);
  await expect(page.getByTestId('chat-root')).toHaveAttribute('data-chat-theme', theme);
  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: phase06VisualFixture.selectedTitle })).toBeVisible();
  await seedPhase06Presence(page);
  await expect(page.getByText('The socket reconnect looked clean. Presence updated fast.')).toBeVisible();
};

const expectNoHorizontalOverflow = async (page: Page) => {
  await expect.poll(async () => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
    document.body.scrollWidth <= document.body.clientWidth
  ))).toBe(true);
};

const assertConversationBasics = async (page: Page) => {
  await expect(page.getByRole('textbox', { name: 'Write a private message' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  await expect(page.locator('button[aria-label="Attach file"]')).toBeVisible();
  await expect(page.getByText('Authenticated private session')).toBeVisible();
  await expect(page.getByText('IN-8B21 is typing')).toBeVisible();
  await expect(page.getByTestId('conversation-pane').getByText('message-states-spec.pdf')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download message-states-spec.pdf' }).first()).toBeVisible();
  await expect(page.getByTestId('conversation-pane').getByText('Message failed to send. Retry or dismiss it.')).toBeVisible();
  await expect(page.getByTestId('conversation-pane').getByRole('button', { name: 'Retry' })).toBeVisible();
};

const assertHeaderSearchReuse = async (page: Page) => {
  await page.getByRole('button', { name: 'Search messages' }).first().click();
  await page.getByRole('textbox', { name: 'Search this conversation' }).fill('state');
  await expect(page.getByText('2 results')).toBeVisible();
  await expect(page.getByRole('button', { name: /Jump to message from IN-8B21 .*The socket reconnect looked clean/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Search this conversation' })).toBeHidden();
};

const assertDesktopLayout = async (page: Page) => {
  await expect(page.getByTestId('chat-sidebar')).toBeVisible();
  await expect(page.getByTestId('conversation-pane')).toBeVisible();
  await expect(page.getByTestId('chat-context-rail')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Video call' }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
};

const assertRightRailSearchReuse = async (page: Page) => {
  await page.getByTestId('chat-context-rail').getByRole('button', { name: 'Search messages' }).click();
  await page.getByRole('textbox', { name: 'Search this conversation' }).fill('state');
  await expect(page.getByText('2 results')).toBeVisible();
  await page.keyboard.press('Escape');
};

const assertMobileLayout = async (page: Page) => {
  await expect(page.getByRole('button', { name: 'Open conversations' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search messages' }).first()).toBeVisible();
  const conversationActions = page.getByRole('button', { name: 'More conversation actions' }).first();
  await expect(conversationActions).toBeVisible();
  await conversationActions.click();
  await expect(page.getByRole('menu', { name: 'Conversation actions' }).getByRole('menuitem', { name: 'Conversation details' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('chat-context-rail')).toBeHidden();

  const sidebarBox = await page.getByTestId('chat-sidebar').boundingBox();
  expect(sidebarBox?.x ?? 0).toBeLessThan(-100);

  await page.locator('.chat-messages-scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(async () => {
    const latestMessageBox = await page.locator('[data-message-id="phase06-message-failed"]').boundingBox();
    const composerBox = await page.locator('.composer-dock').boundingBox();

    if (!latestMessageBox || !composerBox) {
      return false;
    }

    return latestMessageBox.y + latestMessageBox.height <= composerBox.y + 1;
  }).toBe(true);
  await expectNoHorizontalOverflow(page);
};

const visualCases = [
  {
    name: 'desktop light',
    theme: 'light' as const,
    viewport: { width: 1440, height: 900 },
    screenshot: '08-ui-desktop-light.png',
    layout: assertDesktopLayout,
    hasRightRail: true,
  },
  {
    name: 'desktop dark',
    theme: 'dark' as const,
    viewport: { width: 1440, height: 900 },
    screenshot: '08-ui-desktop-dark.png',
    layout: assertDesktopLayout,
    hasRightRail: true,
  },
  {
    name: 'mobile light',
    theme: 'light' as const,
    viewport: { width: 390, height: 844 },
    screenshot: '08-ui-mobile-light.png',
    layout: assertMobileLayout,
    hasRightRail: false,
  },
  {
    name: 'mobile dark',
    theme: 'dark' as const,
    viewport: { width: 390, height: 844 },
    screenshot: '08-ui-mobile-dark.png',
    layout: assertMobileLayout,
    hasRightRail: false,
  },
];

for (const visualCase of visualCases) {
  test(`Phase 08 ${visualCase.name} behavior-backed visual smoke`, async ({ page }) => {
    await page.setViewportSize(visualCase.viewport);
    await openPhase06Chat(page, visualCase.theme);
    await assertConversationBasics(page);
    await visualCase.layout(page);
    await page.screenshot({ path: phase08ArtifactPath(visualCase.screenshot) });
    await assertHeaderSearchReuse(page);
    if (visualCase.hasRightRail) {
      await assertRightRailSearchReuse(page);
    }
  });
}

test('mobile drawer conversation search smoke', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPhase06Chat(page, 'light');
  await page.getByRole('button', { name: 'Open conversations' }).click();

  const drawer = page.locator('.chat-sidebar.open');
  await expect(drawer).toBeVisible();
  await expect(page.locator('.chat-overlay.show')).toBeVisible();

  await page.getByRole('textbox', { name: 'Search conversations' }).fill('backfill');
  await expect(page.getByRole('button', { name: /DS-4C9A/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /IN-8B21/ })).not.toBeVisible();
});

test('username New chat continuation selects existing conversation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPhase06Chat(page, 'light');

  await page.getByRole('button', { name: 'Start new chat' }).click();
  await page.getByRole('textbox', { name: 'Username' }).fill('ds.4c9a');
  await page.getByRole('button', { name: 'Send request or open chat' }).click();

  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: 'DS-4C9A' })).toBeVisible();
  await expect(page.getByTestId('conversation-pane').getByText('Backfill complete.')).toBeVisible();
});

test('URL selected chat restore and invalid fallback smoke', async ({ page }) => {
  await mockChatifyApi(page);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`/?chatId=${phase06VisualFixture.secondaryChatId}&chatTheme=light`);
  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: 'DS-4C9A' })).toBeVisible();

  await page.goto('/?chatId=not-accessible&chatTheme=light');
  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: 'DS-4C9A' })).toBeVisible();
  await expect(page).not.toHaveURL(/not-accessible/);
});

test('auth-expired smoke hides private conversation content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPhase06Chat(page, 'light');

  await expect(page.getByTestId('conversation-pane').getByText('Status check: retry packet needs another pass.')).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('chatify:auth-expired'));
  });

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('conversation-pane').getByText('Status check: retry packet needs another pass.')).not.toBeVisible();
});
