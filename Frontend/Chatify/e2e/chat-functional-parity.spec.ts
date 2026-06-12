import { expect, test } from '@playwright/test';
import {
  PHASE07_CONTINUATION_EMAIL,
  PHASE07_PRIMARY_CHAT_ID,
  PHASE07_SECONDARY_CHAT_ID,
  phase07BehaviorFixture,
} from './fixtures/phase07BehaviorFixture';
import {
  applyVisibleRealtimeUpdate,
  expectComposerDoesNotOverlapLatestMessage,
  expectNoHorizontalOverflow,
  openPhase07Chat,
  phase07ArtifactPath,
} from './pages/chatPage';

test.describe('Phase 07 functional parity', () => {
  test('functional parity desktop light search send retry and rail evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPhase07Chat(page, { theme: 'light', chatId: PHASE07_PRIMARY_CHAT_ID });
    const conversationPane = page.getByTestId('conversation-pane');

    await expect(conversationPane.getByRole('heading', { name: phase07BehaviorFixture.primaryTitle })).toBeVisible();
    await expect(conversationPane.getByText('Live data handoff completed after the reconnect check.')).toBeVisible();

    await page.getByRole('textbox', { name: 'Search conversations' }).fill('matrix');
    await expect(page.getByRole('button', { name: /Matrix Sync/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Relay Node/ })).not.toBeVisible();

    await page.getByRole('textbox', { name: 'Search conversations' }).fill('no matching node');
    await expect(page.getByText('No matching conversations')).toBeVisible();
    await page.getByRole('textbox', { name: 'Search conversations' }).fill('');

    await page.getByRole('button', { name: 'Search messages' }).first().click();
    await page.getByRole('textbox', { name: 'Search this conversation' }).fill('l');
    await expect(page.getByText('Type at least 2 characters to search.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Search this conversation' }).fill('live');
    await expect(page.getByText('2 results')).toBeVisible();
    await page.getByRole('button', { name: /Jump to message from Relay Node .*Live data handoff completed/ }).click();
    await expect(page.locator('[data-message-id="behavior-message-live-data"]')).toHaveClass(/message-search-highlight/);

    await page.getByRole('textbox', { name: 'Write a private message' }).fill('Browser send proof from Phase 07.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Browser send proof from Phase 07.')).toBeVisible();

    await conversationPane.locator('.chat-messages-scroll').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await conversationPane.getByRole('button', { name: 'Retry' }).first().click();
    await expect(conversationPane.getByText('Retry packet recovered through mocked API.')).toBeVisible();
    await conversationPane.getByRole('button', { name: 'Dismiss' }).click();
    await expect(conversationPane.getByText('Dismiss packet should disappear from the view.')).not.toBeVisible();

    await expect(page.getByRole('button', { name: 'Call' }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Video call' }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'More conversation actions' }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Attach file unavailable in this phase' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Voice message unavailable in this phase' })).toBeDisabled();
    await expect(page.getByText('File sharing is planned for Phase 08.')).toBeVisible();
    await expect(page.getByText('Media sharing is planned for Phase 08.')).toBeVisible();
    await expect(page.getByText('Pinning is not available in this phase.')).toBeVisible();
    await expect(page.getByText('Authenticated private session')).toBeVisible();
    await expect(page.getByText('Authenticated private chat')).toBeVisible();
    await expect(page.getByText('message-states-spec.pdf')).not.toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectComposerDoesNotOverlapLatestMessage(page);
    await page.screenshot({ path: phase07ArtifactPath('07-ui-desktop-light-after-search.png') });
  });

  test('functional parity realtime mobile dark drawer retry and layout evidence', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPhase07Chat(page, { theme: 'dark', chatId: PHASE07_PRIMARY_CHAT_ID });
    const conversationPane = page.getByTestId('conversation-pane');
    await expect(conversationPane.getByRole('heading', { name: phase07BehaviorFixture.primaryTitle })).toBeVisible();

    await expect(conversationPane.getByText('Relay Node is typing')).not.toBeVisible();
    await applyVisibleRealtimeUpdate(page);
    await expect(conversationPane.getByText('Relay Node is typing')).toBeVisible();

    await conversationPane.locator('.chat-messages-scroll').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await conversationPane.getByRole('button', { name: 'Retry' }).first().click();
    await expect(conversationPane.getByText('Retry packet recovered through mocked API.')).toBeVisible();
    await conversationPane.getByRole('button', { name: 'Dismiss' }).click();
    await expect(conversationPane.getByText('Dismiss packet should disappear from the view.')).not.toBeVisible();

    await page.getByRole('button', { name: 'Open conversations' }).click();
    await expect(page.locator('.chat-sidebar.open')).toBeVisible();
    await page.getByRole('textbox', { name: 'Search conversations' }).fill('matrix');
    await page.getByRole('button', { name: /Matrix Sync/ }).click();
    await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: phase07BehaviorFixture.secondaryTitle })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await expectComposerDoesNotOverlapLatestMessage(page);
    await page.screenshot({ path: phase07ArtifactPath('07-ui-mobile-dark-after-retry.png') });
  });

  test('functional parity desktop dark selection search and disabled controls smoke', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPhase07Chat(page, { theme: 'dark', chatId: PHASE07_SECONDARY_CHAT_ID });

    await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: phase07BehaviorFixture.secondaryTitle })).toBeVisible();
    await page.getByRole('button', { name: /Relay Node/ }).click();
    await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: phase07BehaviorFixture.primaryTitle })).toBeVisible();
    await page.getByRole('button', { name: 'Search messages' }).first().click();
    await page.getByRole('textbox', { name: 'Search this conversation' }).fill('live');
    await expect(page.getByText('2 results')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Call' }).first()).toBeDisabled();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: phase07ArtifactPath('07-ui-desktop-dark-after-search.png') });
  });

  test('functional parity mobile light drawer selection evidence', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPhase07Chat(page, { theme: 'light', chatId: PHASE07_PRIMARY_CHAT_ID });

    await page.getByRole('button', { name: 'Open conversations' }).click();
    await expect(page.locator('.chat-overlay.show')).toBeVisible();
    await page.getByRole('textbox', { name: 'Search conversations' }).fill('matrix');
    await expect(page.getByRole('button', { name: /Matrix Sync/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Relay Node/ })).not.toBeVisible();
    await page.getByRole('button', { name: /Matrix Sync/ }).click();
    await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: phase07BehaviorFixture.secondaryTitle })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: phase07ArtifactPath('07-ui-mobile-light-after-drawer.png') });
  });

  test('functional parity URL restore fallback new chat and auth expiry', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPhase07Chat(page, { theme: 'light', chatId: PHASE07_SECONDARY_CHAT_ID });
    const conversationPane = page.getByTestId('conversation-pane');

    await expect(conversationPane.getByRole('heading', { name: phase07BehaviorFixture.secondaryTitle })).toBeVisible();
    await page.goto('/?chatId=not-accessible&chatTheme=light');
    await expect(page).not.toHaveURL(/not-accessible/);
    await expect(conversationPane.getByRole('heading')).toBeVisible();

    await page.getByRole('button', { name: 'Start new chat' }).click();
    await page.getByRole('textbox', { name: 'Email address' }).fill(PHASE07_CONTINUATION_EMAIL);
    await page.getByRole('button', { name: 'Start or continue chat' }).click();
    await expect(conversationPane.getByRole('heading', { name: phase07BehaviorFixture.secondaryTitle })).toBeVisible();
    await expect(conversationPane.getByText('Matrix sync is ready for the continuation path.')).toBeVisible();

    await page.evaluate(() => {
      window.dispatchEvent(new Event('chatify:auth-expired'));
    });

    await expect(page).toHaveURL(/\/login/);
    await expect(conversationPane.getByText('Matrix sync is ready for the continuation path.')).not.toBeVisible();
  });
});
