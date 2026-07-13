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

const collectUnexpectedBrowserErrors = (page: Page) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    const text = message.text();
    if (
      message.type() === 'error' &&
      !text.startsWith('Failed to load resource:') &&
      !text.includes('/socket.io/')
    ) {
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    if (!request.url().includes('/socket.io/')) {
      failedRequests.push(new URL(request.url()).pathname);
    }
  });

  return { consoleErrors, failedRequests };
};

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

const profileImageSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#109080"/><stop offset="1" stop-color="#005044"/></linearGradient></defs>
    <rect width="64" height="64" rx="14" fill="url(#g)"/>
    <path d="M32 12 52 32 32 52 12 32Z M32 20 44 32 32 44 20 32Z" fill="none" stroke="#f0f0f0" stroke-width="2"/>
  </svg>
`;

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
  await page.route('**/api/user/*/profile-image**', (route) => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: profileImageSvg,
  }));
  await page.route('**/api/csrf-token', (route) => fulfillJson(route, { csrfToken: 'ui-smoke-token' }));
  await page.route('**/api/auth/is-authenticated', (route) => fulfillJson(route, { token: true }));
  await page.route('**/api/user/get-logged-user', (route) => fulfillJson(route, { status: 'success', user: phase06VisualFixture.currentUser }));
  await page.route('**/api/user/online-users', (route) => fulfillJson(route, createPresenceSnapshot()));
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
  await page.route('**/api/space', (route) => fulfillJson(route, {
    status: 'success',
    data: { spaces: [] },
  }));
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
  const composerMetrics = await page.locator('.composer-dock').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      bottom: rect.bottom,
      viewportHeight: window.innerHeight,
    };
  });

  expect(composerMetrics.scrollHeight).toBeLessThanOrEqual(composerMetrics.clientHeight + 1);
  expect(composerMetrics.bottom).toBeLessThanOrEqual(composerMetrics.viewportHeight + 1);
  await expectNoHorizontalOverflow(page);
};

const assertTabletLayout = async (page: Page) => {
  await expect(page.getByTestId('chat-sidebar')).toBeVisible();
  await expect(page.getByTestId('conversation-pane')).toBeVisible();
  await expect(page.getByTestId('chat-context-rail')).toBeHidden();
  await page.getByRole('button', { name: 'Open conversation details' }).click();
  const detailsDialog = page.getByRole('dialog', { name: 'Conversation details' });
  await expect(detailsDialog).toBeVisible();
  await detailsDialog.getByRole('button', { name: 'Close conversation details' }).click();
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
  {
    name: 'tablet RTL dark',
    theme: 'dark' as const,
    viewport: { width: 768, height: 1024 },
    screenshot: '08-ui-tablet-rtl-dark.png',
    layout: assertTabletLayout,
    hasRightRail: false,
    locale: 'ar' as const,
  },
];

for (const visualCase of visualCases) {
  test(`Phase 08 ${visualCase.name} behavior-backed visual smoke`, async ({ page }) => {
    await page.setViewportSize(visualCase.viewport);
    if ('locale' in visualCase && visualCase.locale) {
      await page.addInitScript((locale) => {
        window.localStorage.setItem('chatify_locale', locale);
      }, visualCase.locale);
    }
    await openPhase06Chat(page, visualCase.theme);
    if ('locale' in visualCase && visualCase.locale === 'ar') {
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    }
    await assertConversationBasics(page);
    await visualCase.layout(page);
    await page.screenshot({ path: phase08ArtifactPath(visualCase.screenshot) });
    if (visualCase.name === 'desktop dark') {
      await page.screenshot({ path: phase08ArtifactPath('08-ui-desktop-dark-full-page.png'), fullPage: true });
    }
    await assertHeaderSearchReuse(page);
    if (visualCase.hasRightRail) {
      await assertRightRailSearchReuse(page);
    }
  });
}

test('stable selection, repeated activation, detail disclosure, and keyboard focus visual evidence', async ({ page }) => {
  const browserErrors = collectUnexpectedBrowserErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPhase06Chat(page, 'dark');

  const secondChat = page.getByRole('button', { name: /DS-4C9A/ });
  const middleChat = page.getByRole('button', { name: /PM-3D12/ });
  const lastChat = page.locator('.chat-list-item').last();

  const restingBackground = await secondChat.evaluate((element) => getComputedStyle(element).backgroundColor);
  await secondChat.hover();
  await expect.poll(() => secondChat.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(restingBackground);

  await secondChat.click();
  await expect(secondChat).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.chat-list-item[aria-pressed="true"]')).toHaveCount(1);

  await middleChat.click();
  await expect(middleChat).toHaveAttribute('aria-pressed', 'true');
  await expect(secondChat).toHaveAttribute('aria-pressed', 'false');

  const lastTitle = lastChat.locator('span.truncate[dir="auto"]').first();
  const originalTitle = await lastTitle.textContent();
  await lastTitle.evaluate((element) => {
    element.textContent = 'Cipher Node — International operations, incident coordination, and extremely long localized routing context';
  });
  await expectNoHorizontalOverflow(page);
  await lastTitle.evaluate((element, title) => {
    element.textContent = title;
  }, originalTitle);

  await middleChat.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(lastChat).toBeFocused();
  await page.screenshot({ path: phase08ArtifactPath('08-ui-desktop-dark-keyboard-focus.png') });
  await page.keyboard.press('Enter');
  await expect(lastChat).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.chat-list-item[aria-pressed="true"]')).toHaveCount(1);

  const selectedUrl = page.url();
  await page.keyboard.press('Enter');
  await expect(lastChat).toHaveAttribute('aria-pressed', 'true');
  expect(page.url()).toBe(selectedUrl);

  const pinnedDisclosure = page.getByTestId('chat-context-rail').getByRole('button', { name: /Pinned messages/ });
  const mediaDisclosure = page.getByTestId('chat-context-rail').getByRole('button', { name: /Shared media/ });
  await pinnedDisclosure.click();
  await expect(pinnedDisclosure).toHaveAttribute('aria-expanded', 'false');
  await expect(mediaDisclosure).toHaveAttribute('aria-expanded', 'true');
  await page.screenshot({ path: phase08ArtifactPath('08-ui-desktop-dark-alternate-selection.png') });
  expect(browserErrors.consoleErrors).toEqual([]);
  expect(browserErrors.failedRequests).toEqual([]);
});

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
