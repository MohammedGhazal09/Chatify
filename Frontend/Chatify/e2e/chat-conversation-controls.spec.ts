import { expect, test, type Page, type Route } from '@playwright/test';
import type { Chat, ConversationControls } from '../src/types/chat';
import { PHASE09_PRIMARY_CHAT_ID, phase09QualityGateFixture } from './fixtures/phase09QualityGateFixture';
import { installPhase09ApiMocks } from './pages/chatPage';

const fulfillJson = (route: Route, body: unknown, status = 200) =>
  route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });

const currentUserId = phase09QualityGateFixture.currentUser._id;
const primaryChat = phase09QualityGateFixture.chats.find((chat) => chat._id === PHASE09_PRIMARY_CHAT_ID);
const peerId = primaryChat?.members.find((member) => member._id !== currentUserId)?._id ?? null;

const activeControls: ConversationControls = {
  isDirectChat: true,
  peerId,
  canSendMessage: true,
  canBlockUser: true,
  canUnblockUser: false,
  blockedByMe: false,
  blockedMe: false,
  messagingDisabledReason: null,
};

const blockedByMeControls: ConversationControls = {
  ...activeControls,
  canSendMessage: false,
  canBlockUser: false,
  canUnblockUser: true,
  blockedByMe: true,
  messagingDisabledReason: 'blocked_by_me',
};

const withControls = (chat: Chat, controls: ConversationControls) => (
  chat._id === PHASE09_PRIMARY_CHAT_ID
    ? { ...chat, conversationControls: controls }
    : chat
);

const installPhase11ControlOverrides = async (page: Page) => {
  let blockedByMe = false;

  const currentControls = () => (blockedByMe ? blockedByMeControls : activeControls);
  const currentChat = () => withControls(phase09QualityGateFixture.chats[0], currentControls());
  const currentChats = () => phase09QualityGateFixture.chats.map((chat) => withControls(chat, currentControls()));

  await page.route('**/api/chat/get-all-chats', (route) => fulfillJson(route, {
    status: 'success',
    data: {
      chats: currentChats(),
    },
  }));

  await page.route(`**/api/chat/${PHASE09_PRIMARY_CHAT_ID}/block`, (route) => {
    const method = route.request().method();

    if (method === 'POST') {
      blockedByMe = true;
    } else if (method === 'DELETE') {
      blockedByMe = false;
    }

    fulfillJson(route, {
      status: 'success',
      data: {
        chat: currentChat(),
        conversationControls: currentControls(),
      },
    });
  });
};

const openPhase11Chat = async (page: Page, theme: 'light' | 'dark' = 'light') => {
  await installPhase09ApiMocks(page);
  await installPhase11ControlOverrides(page);
  await page.goto(`/?chatId=${PHASE09_PRIMARY_CHAT_ID}&chatTheme=${theme}`);
  await expect(page.getByTestId('chat-root')).toHaveAttribute('data-chat-theme', theme, { timeout: 15000 });
  await expect(page.getByTestId('conversation-pane').getByRole('heading')).toBeVisible();
};

const openMoreMenu = async (page: Page) => {
  const moreButton = page.getByRole('button', { name: 'More conversation actions' }).first();
  await moreButton.click();
  const menu = page.getByRole('menu', { name: 'Conversation actions' });
  await expect(menu).toBeVisible();
  return menu;
};

test.describe('Phase 11 conversation controls', () => {
  test('opens real More, search, and detail workflows from one menu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPhase11Chat(page);

    let menu = await openMoreMenu(page);
    await expect(menu.getByRole('menuitem', { name: 'Conversation details' })).toBeEnabled();
    await expect(menu.getByRole('menuitem', { name: 'Search messages' })).toBeEnabled();
    await expect(menu.getByRole('menuitem', { name: 'Block user' })).toBeEnabled();

    await menu.getByRole('menuitem', { name: 'Search messages' }).click();
    const searchInput = page.getByRole('textbox', { name: 'Search this conversation' });
    await expect(searchInput).toBeFocused();
    await searchInput.fill('routing');
    await expect(page.getByText('3 results')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(searchInput).toBeHidden();

    menu = await openMoreMenu(page);
    await menu.getByRole('menuitem', { name: 'Conversation details' }).click();
    const rail = page.getByTestId('chat-context-rail');
    await expect(rail).toBeVisible();
    await expect(rail.getByRole('heading', { name: 'Pinned messages' })).toBeVisible();
    await expect(rail.getByRole('heading', { name: 'Shared files' })).toBeVisible();
    await rail.getByRole('button', { name: 'Close conversation details' }).click();
    await expect(rail).toBeHidden();
  });

  test('blocks and unblocks from the conversation controls path', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPhase11Chat(page, 'dark');

    let menu = await openMoreMenu(page);
    await menu.getByRole('menuitem', { name: 'Block user' }).click();

    const conversationPane = page.getByTestId('conversation-pane');
    await expect(conversationPane.getByRole('alert')).toContainText('You blocked Relay Grid');
    await expect(page.getByRole('textbox', { name: 'Write a private message' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await expect(page.getByText('User blocked. New activity is disabled for this conversation.')).toBeVisible();

    menu = await openMoreMenu(page);
    await expect(menu.getByRole('menuitem', { name: 'Unblock user' })).toBeEnabled();
    await menu.getByRole('menuitem', { name: 'Unblock user' }).click();

    await expect(page.getByText('User unblocked. Messaging controls are available again.')).toBeVisible();
    await expect(conversationPane.getByRole('alert')).toBeHidden();
    await expect(page.getByRole('textbox', { name: 'Write a private message' })).toBeEnabled();
    await page.getByRole('textbox', { name: 'Write a private message' }).fill('Phase 11 unblock proof message');
    await expect(page.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });
});
