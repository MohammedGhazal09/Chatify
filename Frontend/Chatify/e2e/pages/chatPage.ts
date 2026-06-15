import { Buffer } from 'node:buffer';
import path from 'node:path';
import { expect, type Page, type Route } from '@playwright/test';
import {
  PHASE07_PRIMARY_CHAT_ID,
  createPhase07PersistedMessage,
  phase07BehaviorFixture,
  type CreateMessageInput,
} from '../fixtures/phase07BehaviorFixture';
import {
  PHASE09_PRIMARY_CHAT_ID,
  PHASE09_UPLOAD_FILE_NAME,
  createPhase09PersistedMessage,
  phase09QualityGateFixture,
  type CreatePhase09MessageInput,
} from '../fixtures/phase09QualityGateFixture';

export const phase07ArtifactPath = (fileName: string) => path.resolve(
  process.cwd(),
  '../../.planning/phases/07-messenger-functional-parity-restoration',
  fileName
);

export const phase09ArtifactPath = (fileName: string) => path.resolve(
  process.cwd(),
  '../../.planning/phases/09-messenger-interaction-quality-gate',
  fileName
);

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

const createPresenceSnapshot = (
  presence: readonly { userId: string; userName?: string; isOnline: boolean; isCallReachable?: boolean; lastSeen?: string }[]
) => {
  const allContacts = presence.map((status) => {
    const [firstName = 'Contact', ...lastNameParts] = (status.userName ?? 'Contact').split(' ');

    return {
      _id: status.userId,
      firstName,
      lastName: lastNameParts.join(' '),
      isOnline: status.isOnline,
      isCallReachable: status.isCallReachable ?? status.isOnline,
      lastSeen: status.lastSeen,
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
  await page.route('**/api/user/online-users', (route) => fulfillJson(
    route,
    createPresenceSnapshot(phase07BehaviorFixture.presence)
  ));
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

const getMultipartField = (body: string, name: string) => {
  const pattern = new RegExp(`name="${name}"\\r?\\n\\r?\\n([\\s\\S]*?)(?:\\r?\\n--|$)`);
  return pattern.exec(body)?.[1]?.trim() ?? '';
};

const parsePhase09CreateMessageInput = async (route: Route): Promise<CreatePhase09MessageInput> => {
  const request = route.request();
  const contentType = request.headers()['content-type'] ?? '';

  if (contentType.includes('multipart/form-data')) {
    const body = (await request.postDataBuffer()).toString('utf8');
    return {
      chatId: getMultipartField(body, 'chatId') || PHASE09_PRIMARY_CHAT_ID,
      text: getMultipartField(body, 'text') || 'Attachment selection passed through the quality gate.',
      clientMessageId: getMultipartField(body, 'clientMessageId') || `phase09-upload-${Date.now()}`,
      hasAttachment: true,
    };
  }

  try {
    const payload = request.postDataJSON() as CreatePhase09MessageInput;
    return {
      chatId: payload.chatId,
      text: payload.text,
      clientMessageId: payload.clientMessageId,
      hasAttachment: Boolean(payload.hasAttachment),
    };
  } catch {
    return {
      chatId: PHASE09_PRIMARY_CHAT_ID,
      text: 'Quality gate message persisted.',
      clientMessageId: `phase09-created-${Date.now()}`,
    };
  }
};

export const installPhase09ApiMocks = async (page: Page) => {
  const messagesByChatId = new Map<string, unknown[]>(
    Object.entries(phase09QualityGateFixture.messagesByChatId).map(([chatId, messages]) => [
      chatId,
      [...messages],
    ])
  );

  await page.route('**/api/csrf-token', (route) => fulfillJson(route, { csrfToken: 'phase09-token' }));
  await page.route('**/api/auth/is-authenticated', (route) => fulfillJson(route, { token: true }));
  await page.route('**/api/user/get-logged-user', (route) => fulfillJson(route, {
    status: 'success',
    user: phase09QualityGateFixture.currentUser,
  }));
  await page.route('**/api/user/online-users', (route) => fulfillJson(
    route,
    createPresenceSnapshot(phase09QualityGateFixture.presence)
  ));
  await page.route('**/api/auth/logout', (route) => fulfillJson(route, { status: 'success' }));
  await page.route('**/api/chat/get-all-chats', (route) => fulfillJson(route, {
    status: 'success',
    data: { chats: phase09QualityGateFixture.chats },
  }));
  await page.route('**/api/chat/create-new-chat', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      chat: phase09QualityGateFixture.chats.find((chat) => chat._id === phase09QualityGateFixture.secondaryChatId),
    },
  }));
  await page.route('**/api/message/new-message', async (route) => {
    const payload = await parsePhase09CreateMessageInput(route);
    const message = createPhase09PersistedMessage(payload);
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
    const assets = kind === 'media'
      ? phase09QualityGateFixture.sharedMedia
      : kind === 'file'
        ? phase09QualityGateFixture.sharedFiles
        : [...phase09QualityGateFixture.sharedFiles, ...phase09QualityGateFixture.sharedMedia];

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
      pinnedMessages: phase09QualityGateFixture.pinnedMessages,
      limit: 20,
    },
  }));
  await page.route('**/api/message/attachments/*/preview', (route) => {
    const isMedia = route.request().url().includes('circuit-grid') || route.request().url().includes('signal-tiles');
    route.fulfill({
      status: 200,
      contentType: isMedia ? 'image/png' : 'application/pdf',
      body: isMedia ? transparentPng : 'phase09 protected preview',
    });
  });
  await page.route('**/api/message/attachments/*/download', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      body: 'phase09 protected download',
    });
  });
  await page.route(`**/api/message/search/${PHASE09_PRIMARY_CHAT_ID}**`, (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('q') ?? '';
    const normalizedQuery = query.toLowerCase();
    const shouldReturnResults = ['routing', 'delivery', 'asset', 'ledger'].some((term) => normalizedQuery.includes(term));

    fulfillJson(route, {
      status: 'messages searched successfully',
      data: {
        messages: shouldReturnResults ? phase09QualityGateFixture.searchMessages : [],
        query,
        limit: 25,
      },
    });
  });
  await page.route('**/api/message/batch/unread-counts', (route) => fulfillJson(route, {
    status: 'success',
    data: { counts: phase09QualityGateFixture.unreadCounts },
  }));
  await page.route('**/api/message/*/mark-read', (route) => fulfillJson(route, {
    status: 'success',
    data: { unreadCount: 0, receipts: [] },
  }));
  await page.route('**/api/message/*/pin', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      message: phase09QualityGateFixture.messagesByChatId[PHASE09_PRIMARY_CHAT_ID][1],
      pinnedMessage: phase09QualityGateFixture.pinnedMessages[0],
    },
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

export const openPhase09Chat = async (
  page: Page,
  {
    theme = 'light',
    chatId = phase09QualityGateFixture.selectedChatId,
  }: {
    theme?: 'light' | 'dark';
    chatId?: string;
  } = {}
) => {
  await installPhase09ApiMocks(page);
  await page.goto(`/?chatId=${chatId}&chatTheme=${theme}`);
  await expect(page.getByTestId('chat-root')).toHaveAttribute('data-chat-theme', theme, { timeout: 15000 });
  await expect(page.getByTestId('conversation-pane').getByRole('heading')).toBeVisible();
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

export const applyPhase09RealtimeState = async (page: Page) => {
  await page.evaluate(async ({ presence, typingUsers }) => {
    const { usePresenceStore } = await import('/src/store/presenceStore.ts');
    const store = usePresenceStore.getState();

    store.replaceOnlineUsers(presence);
    typingUsers.forEach((typing) => {
      store.setUserTyping(typing.chatId, typing);
    });
  }, {
    presence: phase09QualityGateFixture.presence,
    typingUsers: phase09QualityGateFixture.typingUsers,
  });
};

export const expectMobileSidebarWithinViewport = async (page: Page) => {
  await expect.poll(async () => {
    const box = await page.locator('.chat-sidebar.open').boundingBox();
    const viewport = page.viewportSize();

    if (!box || !viewport) {
      return false;
    }

    return box.x >= -1 &&
      box.y >= -1 &&
      box.width <= viewport.width &&
      box.x + box.width <= viewport.width + 1 &&
      box.height <= viewport.height + 1;
  }).toBe(true);
};

export const expectConversationDetailWithinViewport = async (page: Page) => {
  await expect.poll(async () => {
    const box = await page.getByRole('dialog', { name: 'Conversation details' }).boundingBox();
    const viewport = page.viewportSize();

    if (!box || !viewport) {
      return false;
    }

    return box.x >= -1 &&
      box.y >= -1 &&
      box.x + box.width <= viewport.width + 1 &&
      box.y + box.height <= viewport.height + 1;
  }).toBe(true);
};

export const expectDesktopRailWithinViewport = async (page: Page) => {
  await expect.poll(async () => {
    const box = await page.getByTestId('chat-context-rail').boundingBox();
    const viewport = page.viewportSize();

    if (!box || !viewport) {
      return false;
    }

    return box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= viewport.width + 1 &&
      box.y + box.height <= viewport.height + 1;
  }).toBe(true);
};

export const expectVisibleTouchTargets = async (page: Page, labels: string[]) => {
  for (const label of labels) {
    const escapedLabel = label.replace(/"/g, '\\"');
    const explicitButton = page.locator(`button[aria-label="${escapedLabel}"]:visible`).first();
    const target = await explicitButton.count() > 0
      ? explicitButton
      : page.getByRole('button', { name: label }).first();
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    expect(box, `${label} touch target should have a bounding box`).not.toBeNull();
    expect(box?.width ?? 0, `${label} touch target width`).toBeGreaterThanOrEqual(40);
    expect(box?.height ?? 0, `${label} touch target height`).toBeGreaterThanOrEqual(40);
  }
};

export const expectNoForbiddenUserFacingEvidence = async (page: Page) => {
  const result = await page.evaluate(() => {
    const text = document.body.innerText.toLowerCase();
    const forbiddenTerms = [
      'in-8b21',
      'message-states-spec',
      'delivery-metrics',
      'retry-logic-notes',
      'profile photo',
      'realistic avatar',
      'portrait',
      'silhouette',
      'human',
      'face',
      'hands',
      'body',
      'animal',
      'pet',
      'bird',
      'insect',
      'plant',
      'flower',
      'tree',
      'mascot',
    ];
    const leakedTerms = forbiddenTerms.filter((term) => text.includes(term));
    const assetAttributes = Array.from(document.querySelectorAll('[href], [src]'))
      .flatMap((element) => ['href', 'src'].map((attribute) => element.getAttribute(attribute) ?? ''))
      .filter(Boolean);
    const leakedAssetAttributes = assetAttributes.filter((value) => (
      /gridfs|bucket|objectkey|object-key|storage-key|raw-hash|file-hash|sha256|private-metadata/i.test(value)
    ));

    return { leakedTerms, leakedAssetAttributes };
  });

  expect(result).toEqual({ leakedTerms: [], leakedAssetAttributes: [] });
};

export const makePhase09UploadFile = () => ({
  name: PHASE09_UPLOAD_FILE_NAME,
  mimeType: 'text/plain',
  buffer: Buffer.from('Phase 09 abstract upload fixture for protected attachment proof.'),
});
