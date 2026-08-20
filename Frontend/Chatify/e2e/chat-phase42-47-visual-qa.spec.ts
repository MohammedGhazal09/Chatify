import path from 'node:path';
import { Buffer } from 'node:buffer';
import { expect, test, type Page, type Route } from '@playwright/test';
import type { User } from '../src/types/auth';
import type { Chat, ContactRequest, ContactRequestsData, Message } from '../src/types/chat';
import type { InviteLink, InviteMaxUses } from '../src/types/invite';
import { makeMessage } from '../src/test/chatFixtures';
import {
  PHASE06_SECONDARY_CHAT_ID,
  PHASE06_SELECTED_CHAT_ID,
  phase06CurrentUser,
  phase06PacketMonitor,
  phase06ProtocolRoom,
  phase06QualityArray,
  phase06VisualFixture,
} from './fixtures/phase06VisualFixture';

const GROUP_CHAT_ID = 'phase06-chat-cipher-node';
const artifactRoot = process.env.HERCULES_ARTIFACT_DIR
  ?? path.resolve(process.cwd(), '../../.planning/phases/42-49-hercules-visual-qa');

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

const parseJsonBody = <T,>(route: Route): T => {
  const rawBody = route.request().postData();
  return rawBody ? JSON.parse(rawBody) as T : {} as T;
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
  page.on('pageerror', (error) => {
    const message = `pageerror: ${error.message}`;
    consoleErrors.push(message);
    console.log(message);
  });

  return { consoleErrors, failedRequests };
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
        username: user.username,
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

const addConversationControls = (chat: Chat): Chat => {
  const peer = chat.members.find((member) => member._id !== phase06CurrentUser._id);

  return {
    ...chat,
    conversationControls: {
      isDirectChat: !chat.isGroupChat,
      peerId: chat.isGroupChat ? null : peer?._id ?? null,
      canSendMessage: true,
      canBlockUser: !chat.isGroupChat,
      canUnblockUser: false,
      blockedByMe: false,
      blockedMe: false,
      messagingDisabledReason: null,
    },
  };
};

const createPhase42To47Chats = () => phase06VisualFixture.chats.map((chat) => {
  if (chat._id === GROUP_CHAT_ID) {
    return addConversationControls({
      ...chat,
      groupAdmin: phase06CurrentUser,
    });
  }

  return addConversationControls({ ...chat });
});

const groupMessage = makeMessage({
  _id: 'phase46-group-mention-seed',
  chatId: GROUP_CHAT_ID,
  sender: phase06ProtocolRoom._id,
  text: `Loop @${phase06CurrentUser.username} into the invite rollout notes.`,
  mentions: [{
    userId: phase06CurrentUser._id,
    username: phase06CurrentUser.username ?? 'ax.7f3c',
    displayName: 'AX-7F3C',
  }],
  createdAt: '2026-06-30T10:00:00.000Z',
  updatedAt: '2026-06-30T10:00:00.000Z',
});

const createDefaultMessagesByChatId = (): Record<string, Message[]> => ({
  [PHASE06_SELECTED_CHAT_ID]: [...phase06VisualFixture.messagesByChatId[PHASE06_SELECTED_CHAT_ID]],
  [PHASE06_SECONDARY_CHAT_ID]: [...phase06VisualFixture.messagesByChatId[PHASE06_SECONDARY_CHAT_ID]],
  [GROUP_CHAT_ID]: [groupMessage],
});

const createContactRequest = ({
  _id,
  requester,
  recipient,
  direction,
}: {
  _id: string;
  requester: User;
  recipient: User;
  direction: ContactRequest['direction'];
}): ContactRequest => ({
  _id,
  requester,
  recipient,
  direction,
  status: 'pending',
  chat: null,
  createdAt: '2026-06-30T09:00:00.000Z',
  updatedAt: '2026-06-30T09:00:00.000Z',
});

const createDefaultContactRequests = (): ContactRequestsData => ({
  incoming: [
    createContactRequest({
      _id: 'phase42-request-incoming',
      requester: phase06ProtocolRoom,
      recipient: phase06CurrentUser,
      direction: 'incoming',
    }),
  ],
  outgoing: [
    createContactRequest({
      _id: 'phase42-request-outgoing',
      requester: phase06CurrentUser,
      recipient: phase06QualityArray,
      direction: 'outgoing',
    }),
  ],
});

const createInviteLink = (
  _id: string,
  maxUses: InviteMaxUses | number | null,
  state: InviteLink['state'] = 'active'
): InviteLink => ({
  _id,
  targetType: 'group',
  targetId: GROUP_CHAT_ID,
  createdBy: phase06CurrentUser,
  expiresAt: '2026-07-07T12:00:00.000Z',
  maxUses: maxUses === 'unlimited' ? null : maxUses,
  useCount: 1,
  lastUsedAt: '2026-06-30T11:00:00.000Z',
  revokedAt: state === 'revoked' ? '2026-06-30T12:00:00.000Z' : null,
  revokedBy: state === 'revoked' ? phase06CurrentUser._id : null,
  state,
  createdAt: '2026-06-30T10:00:00.000Z',
  updatedAt: '2026-06-30T10:00:00.000Z',
});

interface MockPhaseApiOptions {
  chats?: Chat[];
  contacts?: User[];
  contactRequests?: ContactRequestsData;
  messagesByChatId?: Record<string, Message[]>;
  inviteLinks?: InviteLink[];
}

const mockChatifyPhaseApi = async (page: Page, options: MockPhaseApiOptions = {}) => {
  const state = {
    chats: options.chats ?? createPhase42To47Chats(),
    contacts: options.contacts ?? [phase06PacketMonitor],
    contactRequests: options.contactRequests ?? createDefaultContactRequests(),
    messagesByChatId: options.messagesByChatId ?? createDefaultMessagesByChatId(),
    inviteLinks: options.inviteLinks ?? [createInviteLink('phase47-invite-existing', 5)],
  };

  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();

    if (!pathname.startsWith('/api/')) {
      route.continue();
      return;
    }

    if (pathname.includes('/profile-image') || pathname.includes('/attachments/') && pathname.includes('/preview')) {
      route.fulfill({ status: 200, contentType: 'image/png', body: transparentPng });
      return;
    }

    if (pathname.includes('/attachments/') && pathname.includes('/download')) {
      route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'download' });
      return;
    }

    if (pathname === '/api/csrf-token') {
      fulfillJson(route, { csrfToken: 'phase42-47-token' });
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
      fulfillJson(route, { status: 'success', users: state.contacts });
      return;
    }

    if (pathname === '/api/user/online-users') {
      fulfillJson(route, createPresenceSnapshot());
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

    if (pathname === '/api/auth/logout') {
      fulfillJson(route, { status: 'success' });
      return;
    }

    if (pathname === '/api/space') {
      fulfillJson(route, { status: 'success', data: { spaces: [] } });
      return;
    }

    if (pathname === '/api/chat/get-all-chats') {
      fulfillJson(route, { status: 'success', data: { chats: state.chats } });
      return;
    }

    if (pathname === '/api/chat/contact-requests' && method === 'GET') {
      fulfillJson(route, { status: 'success', data: state.contactRequests });
      return;
    }

    if (pathname === '/api/chat/create-new-chat' && method === 'POST') {
      const body = parseJsonBody<{ targetUsername?: string }>(route);
      const recipient = state.contacts.find((contact) => contact.username === body.targetUsername)
        ?? phase06PacketMonitor;
      const contactRequest = createContactRequest({
        _id: 'phase42-request-created',
        requester: phase06CurrentUser,
        recipient,
        direction: 'outgoing',
      });
      state.contactRequests = {
        ...state.contactRequests,
        outgoing: [contactRequest, ...state.contactRequests.outgoing],
      };
      fulfillJson(route, {
        status: 'success',
        data: { contactRequest },
      });
      return;
    }

    const acceptMatch = pathname.match(/^\/api\/chat\/contact-requests\/([^/]+)\/accept$/);
    if (acceptMatch && method === 'POST') {
      const requestId = acceptMatch[1];
      const acceptedRequest = state.contactRequests.incoming.find((item) => item._id === requestId)
        ?? state.contactRequests.incoming[0];
      const acceptedChat = addConversationControls({
        _id: 'phase42-accepted-chat',
        members: [phase06CurrentUser, acceptedRequest.requester],
        unReadMessages: 0,
        latestMessage: null,
        isGroupChat: false,
        createdAt: '2026-06-30T12:00:00.000Z',
        updatedAt: '2026-06-30T12:00:00.000Z',
      });

      state.chats = [acceptedChat, ...state.chats.filter((chat) => chat._id !== acceptedChat._id)];
      state.messagesByChatId[acceptedChat._id] = [];
      state.contactRequests = {
        incoming: state.contactRequests.incoming.filter((item) => item._id !== requestId),
        outgoing: state.contactRequests.outgoing,
      };

      fulfillJson(route, {
        status: 'success',
        data: {
          contactRequest: {
            ...acceptedRequest,
            status: 'accepted',
            chat: acceptedChat._id,
            respondedAt: '2026-06-30T12:00:00.000Z',
          },
          chat: acceptedChat,
        },
      });
      return;
    }

    const declineMatch = pathname.match(/^\/api\/chat\/contact-requests\/([^/]+)\/decline$/);
    if (declineMatch && method === 'POST') {
      const requestId = declineMatch[1];
      const declinedRequest = state.contactRequests.incoming.find((item) => item._id === requestId)
        ?? state.contactRequests.incoming[0];
      state.contactRequests = {
        incoming: state.contactRequests.incoming.filter((item) => item._id !== requestId),
        outgoing: state.contactRequests.outgoing,
      };
      fulfillJson(route, {
        status: 'success',
        data: {
          contactRequest: {
            ...declinedRequest,
            status: 'declined',
            respondedAt: '2026-06-30T12:00:00.000Z',
          },
        },
      });
      return;
    }

    const cancelMatch = pathname.match(/^\/api\/chat\/contact-requests\/([^/]+)$/);
    if (cancelMatch && method === 'DELETE') {
      const requestId = cancelMatch[1];
      const canceledRequest = state.contactRequests.outgoing.find((item) => item._id === requestId)
        ?? state.contactRequests.outgoing[0];
      state.contactRequests = {
        incoming: state.contactRequests.incoming,
        outgoing: state.contactRequests.outgoing.filter((item) => item._id !== requestId),
      };
      fulfillJson(route, {
        status: 'success',
        data: {
          contactRequest: {
            ...canceledRequest,
            status: 'canceled',
            respondedAt: '2026-06-30T12:00:00.000Z',
          },
        },
      });
      return;
    }

    if (pathname.startsWith('/api/message/get-all-messages/')) {
      const chatId = pathname.split('/').at(-1) ?? '';
      fulfillJson(route, {
        status: 'success',
        data: {
          messages: state.messagesByChatId[chatId] ?? [],
          cursor: { nextCursor: null, hasMore: false, limit: 50 },
        },
      });
      return;
    }

    if (pathname === '/api/message/batch/unread-counts') {
      fulfillJson(route, { status: 'success', data: { counts: phase06VisualFixture.unreadCounts } });
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
          pinnedMessages: phase06VisualFixture.pinnedMessages,
          limit: 20,
        },
      });
      return;
    }

    if (pathname === `/api/invite/group/${GROUP_CHAT_ID}` && method === 'GET') {
      fulfillJson(route, { status: 'success', data: { invites: state.inviteLinks } });
      return;
    }

    if (pathname === `/api/invite/group/${GROUP_CHAT_ID}` && method === 'POST') {
      const body = parseJsonBody<{ maxUses?: InviteMaxUses }>(route);
      const invite = createInviteLink('phase47-invite-created', body.maxUses ?? 5);
      state.inviteLinks = [invite, ...state.inviteLinks];
      fulfillJson(route, {
        status: 'success',
        data: {
          invite,
          inviteUrl: 'https://chatify.invalid/invite/phase47-redacted-token',
        },
      });
      return;
    }

    const revokeInviteMatch = pathname.match(/^\/api\/invite\/([^/]+)$/);
    if (revokeInviteMatch && method === 'DELETE') {
      const inviteId = revokeInviteMatch[1];
      const revokedInvite = {
        ...(state.inviteLinks.find((invite) => invite._id === inviteId)
          ?? createInviteLink(inviteId, 5)),
        state: 'revoked' as const,
        revokedAt: '2026-06-30T12:00:00.000Z',
        revokedBy: phase06CurrentUser._id,
      };
      state.inviteLinks = state.inviteLinks.map((invite) => (
        invite._id === inviteId ? revokedInvite : invite
      ));
      fulfillJson(route, { status: 'success', data: { invite: revokedInvite } });
      return;
    }

    if (pathname === '/api/message/saved') {
      fulfillJson(route, { status: 'success', data: { savedMessages: [], messages: [], limit: 50 } });
      return;
    }

    fulfillJson(route, {
      status: 'error',
      message: `Unhandled Phase42-47 mock route: ${method} ${pathname}`,
    }, 404);
  });

  return state;
};

const mockLoginMfaApi = async (page: Page) => {
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (!pathname.startsWith('/api/')) {
      route.continue();
      return;
    }

    if (pathname === '/api/csrf-token') {
      fulfillJson(route, { csrfToken: 'phase45-token' });
      return;
    }

    if (pathname === '/api/auth/is-authenticated') {
      fulfillJson(route, { token: false });
      return;
    }

    if (pathname === '/api/auth/login' && request.method() === 'POST') {
      fulfillJson(route, {
        status: 'mfa_required',
        message: 'Two-factor verification required',
        data: {
          twoFactorRequired: true,
          challengeToken: 'phase45-redacted-challenge',
          expiresAt: '2026-06-30T12:10:00.000Z',
        },
      });
      return;
    }

    if (pathname === '/api/auth/2fa/challenge' && request.method() === 'POST') {
      fulfillJson(route, { status: 'success', message: 'Two-factor login verified' });
      return;
    }

    if (pathname === '/api/user/get-logged-user') {
      fulfillJson(route, {
        status: 'success',
        user: {
          ...phase06CurrentUser,
          twoFactorEnabled: true,
        },
      });
      return;
    }

    fulfillJson(route, {
      status: 'error',
      message: `Unhandled Phase45 mock route: ${request.method()} ${pathname}`,
    }, 404);
  });
};

const openChatFixture = async (
  page: Page,
  pathWithQuery: string,
  viewport: { width: number; height: number },
  options: MockPhaseApiOptions = {}
) => {
  await page.setViewportSize(viewport);
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
  await mockChatifyPhaseApi(page, options);

  const separator = pathWithQuery.includes('?') ? '&' : '?';
  await page.goto(`${pathWithQuery}${separator}chatTheme=light`);
  await expect(page.getByTestId('chat-root')).toHaveAttribute('data-chat-theme', 'light').catch(async (error) => {
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '<body unavailable>');
    console.log(`Chat fixture did not render at ${page.url()}: ${bodyText.slice(0, 500)}`);
    throw error;
  });
};

test('Phase 42 contact requests and trusted onboarding integrated desktop flow', async ({ page }) => {
  const { consoleErrors, failedRequests } = createEvidenceCollectors(page);

  await openChatFixture(page, '/', { width: 1366, height: 768 }, {
    chats: [],
    messagesByChatId: {},
    contacts: [phase06PacketMonitor],
  });

  await expect(page.getByRole('heading', { name: 'No conversations yet' })).toBeVisible();
  await page.getByTestId('conversation-pane').getByRole('button', { name: 'Start a new conversation' }).click();

  const startDialog = page.getByRole('dialog', { name: 'Start a conversation' });
  await expect(startDialog).toBeVisible();
  await expect(startDialog.getByText('Requests')).toBeVisible();
  await expect(startDialog.getByRole('button', { name: 'Accept' })).toBeVisible();
  await expect(startDialog.getByRole('button', { name: 'Decline' })).toBeVisible();
  await expect(startDialog.getByRole('button', { name: 'Cancel request' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase42-desktop-contact-requests.png'), fullPage: true });

  await startDialog.getByRole('button', { name: 'Cancel request' }).click();
  await expect(page.getByText('Request canceled.')).toBeVisible();

  await startDialog.getByRole('button', { name: /Request or open conversation with PM-3D12/ }).click();
  await expect(page.getByText('Request sent. The conversation will appear after they accept.')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase42-desktop-request-sent.png'), fullPage: true });

  await startDialog.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText('Request accepted. Chat is ready.')).toBeVisible();
  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: 'PR-0E6F' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase42-desktop-accepted-chat.png'), fullPage: true });

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('Phase 42 contact requests mobile visual smoke', async ({ page }) => {
  await openChatFixture(page, '/', { width: 390, height: 844 }, {
    chats: [],
    messagesByChatId: {},
    contacts: [phase06PacketMonitor],
  });

  await page.getByTestId('conversation-pane').getByRole('button', { name: 'Start a new conversation' }).click();
  await expect(page.getByRole('dialog', { name: 'Start a conversation' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase42-mobile-contact-requests.png'), fullPage: true });
});

test('Phase 43 replies and Phase 44 per-conversation drafts integrated desktop flow', async ({ page }) => {
  const { consoleErrors, failedRequests } = createEvidenceCollectors(page);
  const draftText = 'Phase 44 draft survives conversation switches';

  await openChatFixture(page, `/?chatId=${PHASE06_SELECTED_CHAT_ID}`, { width: 1366, height: 768 });
  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: 'IN-8B21' })).toBeVisible();

  await page.locator('[data-message-id="phase06-message-quiet"]').getByRole('button', { name: 'Open message actions' }).click();
  await expect(page.getByRole('group', { name: 'Message actions' })).toBeVisible();
  await page.getByRole('button', { name: 'Reply' }).click();
  await expect(page.getByText('Replying to IN-8B21')).toBeVisible();
  await expect(page.locator('.composer-dock').getByText('Keep it quiet and secure, not noisy.')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase43-desktop-reply-preview.png'), fullPage: true });

  const composer = page.getByLabel('Write a private message');
  await composer.fill(draftText);
  await expect(composer).toHaveValue(draftText);

  await page.getByRole('button', { name: /DS-4C9A/ }).click();
  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: 'DS-4C9A' })).toBeVisible();
  await expect(page.getByText(draftText)).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase44-desktop-draft-sidebar.png'), fullPage: true });

  await page.getByRole('button', { name: /IN-8B21/ }).click();
  await expect(page.getByLabel('Write a private message')).toHaveValue(draftText);
  await page.screenshot({ path: screenshotPath('phase44-desktop-draft-restored.png'), fullPage: true });

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('Phase 45 two-factor login challenge visual and validation flow', async ({ page }) => {
  const { consoleErrors, failedRequests } = createEvidenceCollectors(page);

  await page.setViewportSize({ width: 1366, height: 768 });
  await mockLoginMfaApi(page);
  await page.goto('/login');
  await expect(page.getByLabel('Email Address')).toBeVisible({ timeout: 10000 }).catch(async (error) => {
    const bodyText = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '<body unavailable>');
    console.log(`Login fixture did not render at ${page.url()}: ${bodyText.slice(0, 500)}`);
    throw error;
  });

  await page.getByLabel('Email Address').fill('phase45-user@example.test');
  await page.locator('#password').fill('CorrectHorseBatteryStaple42!');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('heading', { name: 'Two-factor verification' })).toBeVisible();
  await expect(page.getByLabel('Verification code')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify' })).toBeDisabled();
  await page.screenshot({ path: screenshotPath('phase45-desktop-two-factor-challenge.png'), fullPage: true });

  await page.getByLabel('Verification code').fill('123456');
  await expect(page.getByRole('button', { name: 'Verify' })).toBeEnabled();
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase45-desktop-back-to-sign-in.png'), fullPage: true });

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('Phase 46 mentions and Phase 47 invite links integrated group flow', async ({ page }) => {
  const { consoleErrors, failedRequests } = createEvidenceCollectors(page);

  await openChatFixture(page, `/?chatId=${GROUP_CHAT_ID}`, { width: 1366, height: 768 });
  await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: 'Cipher Node' })).toBeVisible();

  const composer = page.getByLabel('Write a private message');
  await composer.fill('Please sync @pr');
  const mentionList = page.getByRole('listbox', { name: 'Mention members' });
  await expect(mentionList).toBeVisible();
  await expect(mentionList.getByRole('option', { name: /PR-0E6F/ })).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase46-desktop-mention-suggestions.png'), fullPage: true });

  await mentionList.getByRole('option', { name: /PR-0E6F/ }).click();
  await expect(composer).toHaveValue(/@pr\.0e6f/);

  await page.getByTestId('conversation-pane').getByRole('button', { name: 'More conversation actions' }).click();
  await page.getByRole('menuitem', { name: 'Invite links' }).click();

  const inviteDialog = page.getByRole('dialog', { name: 'Invite links' });
  await expect(inviteDialog).toBeVisible();
  await expect(inviteDialog.getByText('Create a link')).toBeVisible();
  await expect(inviteDialog.getByText('Existing links')).toBeVisible();
  await expect(inviteDialog.getByText('Active')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase47-desktop-invite-links.png'), fullPage: true });

  await inviteDialog.getByRole('button', { name: 'Create invite link' }).click();
  await expect(inviteDialog.getByText('New link')).toBeVisible();
  await expect(inviteDialog.getByText('https://chatify.invalid/invite/phase47-redacted-token')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase47-desktop-created-invite-link.png'), fullPage: true });

  await inviteDialog.getByRole('button', { name: 'Revoke invite link' }).first().click();
  await expect(inviteDialog.getByText('Revoke this invite link?')).toBeVisible();
  await page.screenshot({ path: screenshotPath('phase47-desktop-revoke-confirmation.png'), fullPage: true });

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
