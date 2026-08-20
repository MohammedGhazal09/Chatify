import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  PHASE09_PRIMARY_CHAT_ID,
  PHASE09_SECONDARY_CHAT_ID,
  phase09QualityGateFixture,
} from './fixtures/phase09QualityGateFixture';
import {
  applyPhase09RealtimeState,
  expectComposerDoesNotOverlapLatestMessage,
  expectConversationDetailWithinViewport,
  expectDesktopRailWithinViewport,
  expectMobileSidebarWithinViewport,
  expectNoForbiddenUserFacingEvidence,
  expectNoHorizontalOverflow,
  expectVisibleTouchTargets,
  makePhase09UploadFile,
  openPhase09Chat,
  phase09ArtifactPath,
} from './pages/chatPage';

const runAxeScan = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .include('[data-testid="chat-root"]')
    .analyze();

  expect(results.violations).toEqual([]);
};

const expectVoiceRecorderControl = async (page: Page) => {
  const voiceButton = page.getByRole('button', { name: 'Record voice message' }).first();

  if (await voiceButton.count()) {
    await expect(voiceButton).toBeVisible();

    if (await voiceButton.isDisabled()) {
      await expect(voiceButton).toHaveAttribute('title', /voice recording unavailable/i);
      return;
    }

    await expect(voiceButton).toBeEnabled();
  }
};

const expectUnsupportedControlsUnavailable = async (page: Page) => {
  let callButton = page.getByRole('button', { name: 'Call' }).first();

  if (await callButton.count() === 0) {
    await page.getByRole('button', { name: 'More conversation actions' }).first().click();
    callButton = page.getByRole('menu', { name: 'Conversation actions' }).getByRole('menuitem', { name: 'Call', exact: true });
  }

  await expect(callButton).toBeDisabled();
  await expect(callButton).toHaveAttribute('title', /unavailable|direct chats|online|connection|availability/i);
  const callTargetBox = await callButton.boundingBox();
  expect(callTargetBox?.width ?? 0).toBeGreaterThanOrEqual(40);
  expect(callTargetBox?.height ?? 0).toBeGreaterThanOrEqual(40);

  const openMenu = page.getByRole('menu', { name: 'Conversation actions' });
  const videoButton = await openMenu.count()
    ? openMenu.getByRole('menuitem', { name: 'Video call', exact: true })
    : page.getByRole('button', { name: 'Video call' }).first();
  if (await videoButton.count()) {
    await expect(videoButton).toBeDisabled();
    await expect(videoButton).toHaveAttribute('title', /unavailable|direct chats|online|connection|availability/i);
  }

  if (await openMenu.count()) {
    await page.keyboard.press('Escape');
  }

  await expectVoiceRecorderControl(page);
};

const expectProtectedAssetControls = async (page: Page) => {
  await expect(page.getByText('phase09-routing-ledger.pdf').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open phase09-routing-ledger.pdf' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download phase09-routing-ledger.pdf' }).first()).toHaveAttribute('href', /\/api\/message\/attachments\/phase09-attachment-routing-ledger\/download$/);
  await expect(page.getByRole('button', { name: 'Open phase09-circuit-grid.png' }).first()).toBeVisible();
};

const expectDesktopDetailRailReady = async (page: Page) => {
  const rail = page.getByTestId('chat-context-rail');
  await expect(rail).toBeVisible();
  await expect(rail.getByText('Pinned messages')).toBeVisible();
  await expect(rail.getByText('Shared files')).toBeVisible();
  await expect(rail.getByText('Shared media')).toBeVisible();
  await expect(rail.getByText('Delivery and read receipts stay visible after interaction.')).toBeVisible();
  await expect(rail.getByText('phase09-routing-ledger.pdf')).toBeVisible();
  await expect(rail.getByText('Authenticated session')).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Star conversation' })).toBeEnabled();
  await expect(rail.getByRole('button', { name: 'More conversation actions' })).toBeEnabled();
  await expectDesktopRailWithinViewport(page);
};

const openSearchAndJump = async (page: Page) => {
  const searchButton = page.getByRole('button', { name: 'Search messages' }).first();
  await searchButton.click();
  const searchInput = page.getByRole('textbox', { name: 'Search this conversation' });
  await expect(searchInput).toBeFocused();
  await searchInput.fill('routing');
  await expect(page.getByText('3 results')).toBeVisible();
  await page.getByRole('button', { name: /Jump to message from Relay Grid .*Routing note/ }).click();
  await expect(page.locator('[data-message-id="phase09-message-routing-note"]')).toHaveClass(/message-search-highlight/);

  await searchButton.click();
  await expect(searchInput).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(searchInput).toBeHidden();
  await expect(searchButton).toBeFocused();
};

const sendTextWithKeyboard = async (page: Page) => {
  const composer = page.getByRole('textbox', { name: 'Write a private message' });
  await composer.fill('Keyboard Enter send proof for Phase 09.');
  await composer.press('Enter');
  await expect(page.locator('[data-message-id]').filter({ hasText: 'Keyboard Enter send proof for Phase 09.' })).toBeVisible();

  await composer.fill('First quality line');
  await composer.press('Shift+Enter');
  await composer.type('Second quality line');
  await expect(composer).toHaveValue('First quality line\nSecond quality line');
};

const sendAttachmentMessage = async (page: Page) => {
  await page.locator('input[type="file"][aria-label="Attach file"]').setInputFiles(makePhase09UploadFile());
  await expect(page.getByTestId('attachment-tray').getByText('phase09-upload-sample.txt')).toBeVisible();
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByTestId('conversation-pane').getByText('phase09-upload-sample.txt')).toBeVisible();
};

const getConversationActionsButton = (page: Page) => page.getByRole('button', { name: 'More conversation actions' }).first();

const openConversationDetails = async (page: Page) => {
  const conversationActions = getConversationActionsButton(page);
  await conversationActions.click();
  await page
    .getByRole('menu', { name: 'Conversation actions' })
    .getByRole('menuitem', { name: 'Conversation details' })
    .click();

  return conversationActions;
};

const expectConversationReclaimsClosedRailSpace = async (page: Page) => {
  await expect.poll(async () => {
    const box = await page.getByTestId('conversation-pane').boundingBox();

    if (!box) {
      return 0;
    }

    return Math.round(box.x + box.width);
  }).toBeGreaterThanOrEqual(1430);
};

const resolveRetryAndDismiss = async (page: Page) => {
  const conversationPane = page.getByTestId('conversation-pane');
  await conversationPane.locator('.chat-messages-scroll').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await conversationPane.getByRole('button', { name: 'Retry' }).first().click();
  await expect(conversationPane.getByText('Retry action recovered through the quality gate.')).toBeVisible();
  await conversationPane.getByRole('button', { name: 'Dismiss' }).click();
  await expect(conversationPane.getByText('Dismiss action should remove this controlled failure.')).not.toBeVisible();
};

const assertBaselineConversation = async (page: Page, title = phase09QualityGateFixture.primaryTitle) => {
  const conversationPane = page.getByTestId('conversation-pane');
  await expect(conversationPane.getByRole('heading', { name: title })).toBeVisible();
  await expect(conversationPane.getByText('Session restore kept the selected conversation stable after reload.')).toBeVisible();
  await expect(conversationPane.getByText('Delivery and read receipts stay visible after interaction.')).toBeVisible();
  await expectProtectedAssetControls(page);
  await expectUnsupportedControlsUnavailable(page);
  await expectNoHorizontalOverflow(page);
};

test.describe('Phase 09 messenger interaction quality gate', () => {
  test('desktop light critical workflows, accessibility, detail rail, and screenshot evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPhase09Chat(page, { theme: 'light', chatId: PHASE09_PRIMARY_CHAT_ID });
    await applyPhase09RealtimeState(page);
    await assertBaselineConversation(page);
    await expect(page.getByText('Relay Grid is typing')).toBeVisible();

    await page.getByRole('textbox', { name: 'Search conversations' }).fill('vault');
    await expect(page.getByRole('button', { name: /Cipher Vault/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Relay Grid/ })).not.toBeVisible();
    await page.getByRole('textbox', { name: 'Search conversations' }).fill('');

    await openSearchAndJump(page);
    await sendTextWithKeyboard(page);
    await sendAttachmentMessage(page);
    await resolveRetryAndDismiss(page);
    await expectDesktopDetailRailReady(page);
    await expectComposerDoesNotOverlapLatestMessage(page);
    await expectNoForbiddenUserFacingEvidence(page);
    await runAxeScan(page);

    await page.screenshot({ path: phase09ArtifactPath('09-ui-desktop-light-quality.png') });
  });

  test('desktop dark restore, continuation, disabled controls, auth cleanup, and screenshot evidence', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPhase09Chat(page, { theme: 'dark', chatId: PHASE09_SECONDARY_CHAT_ID });
    await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: phase09QualityGateFixture.secondaryTitle })).toBeVisible();
    await page.goto(`/?chatId=${PHASE09_PRIMARY_CHAT_ID}&chatTheme=dark`);
    await assertBaselineConversation(page);

    await page.getByRole('button', { name: 'Start new chat' }).click();
    await page.getByRole('textbox', { name: 'Username' }).fill(phase09QualityGateFixture.continuationUsername);
    await page.getByRole('button', { name: 'Send request or open chat' }).click();
    await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: phase09QualityGateFixture.secondaryTitle })).toBeVisible();
    await page.getByRole('button', { name: /Relay Grid/ }).click();
    await expectDesktopDetailRailReady(page);
    await expectNoForbiddenUserFacingEvidence(page);

    await page.screenshot({ path: phase09ArtifactPath('09-ui-desktop-dark-quality.png') });

    await page.evaluate(() => {
      window.dispatchEvent(new Event('chatify:auth-expired'));
    });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Session restore kept the selected conversation stable after reload.')).not.toBeVisible();
  });

  test('mobile light drawer, detail dialog, focus return, touch targets, and screenshot evidence', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPhase09Chat(page, { theme: 'light', chatId: PHASE09_PRIMARY_CHAT_ID });
    await assertBaselineConversation(page);

    await page.getByRole('button', { name: 'Open conversations' }).click();
    await expectMobileSidebarWithinViewport(page);
    await page.getByRole('textbox', { name: 'Search conversations' }).fill('vector');
    await page.getByRole('button', { name: /Vector Archive/ }).click();
    await expect(page.getByTestId('conversation-pane').getByRole('heading', { name: phase09QualityGateFixture.secondaryTitle })).toBeVisible();
    await page.getByRole('button', { name: 'Open conversations' }).click();
    await page.getByRole('textbox', { name: 'Search conversations' }).fill('relay');
    await page.getByRole('button', { name: /Relay Grid/ }).click();
    await assertBaselineConversation(page);

    const detailsButton = await openConversationDetails(page);
    const detailsDialog = page.getByRole('dialog', { name: 'Conversation details' });
    await expect(detailsDialog).toBeVisible();
    await expectConversationDetailWithinViewport(page);
    await expect(detailsDialog.getByText('phase09-routing-ledger.pdf')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Conversation details' })).toBeHidden();
    await expect(detailsButton).toBeFocused();

    await expectVisibleTouchTargets(page, [
      'Open conversations',
      'More conversation actions',
      'Attach file',
      'Send message',
    ]);
    await openConversationDetails(page);
    await expect(page.getByRole('dialog', { name: 'Conversation details' })).toBeVisible();
    await expectVisibleTouchTargets(page, ['Close conversation details']);
    await expectNoHorizontalOverflow(page);
    await expectNoForbiddenUserFacingEvidence(page);
    await runAxeScan(page);

    await page.screenshot({ path: phase09ArtifactPath('09-ui-mobile-light-quality.png') });
  });

  test('mobile dark realtime retry layout, message actions escape, and screenshot evidence', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPhase09Chat(page, { theme: 'dark', chatId: PHASE09_PRIMARY_CHAT_ID });
    await applyPhase09RealtimeState(page);
    await expect(page.getByText('Relay Grid is typing')).toBeVisible();
    await resolveRetryAndDismiss(page);

    const actionsTrigger = page.locator('[data-message-id="phase09-message-delivery-read"] button[aria-label="Open message actions"]');
    await actionsTrigger.click({ force: true });
    await expect(page.getByRole('group', { name: 'Message actions' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('group', { name: 'Message actions' })).toBeHidden();
    await expect(actionsTrigger).toBeFocused();

    await expectNoHorizontalOverflow(page);
    await expectComposerDoesNotOverlapLatestMessage(page);
    await page.getByRole('button', { name: 'Search messages' }).click();
    await page.getByRole('textbox', { name: 'Search this conversation' }).fill('asset');
    await expect(page.getByText('3 results')).toBeVisible();
    await expectNoForbiddenUserFacingEvidence(page);

    await page.screenshot({ path: phase09ArtifactPath('09-ui-mobile-dark-quality.png') });
  });
});

test.describe('Phase 10 production messenger reality', () => {
  test('desktop detail rail closes, returns focus, reopens, and keeps search active', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPhase09Chat(page, { theme: 'dark', chatId: PHASE09_PRIMARY_CHAT_ID });

    const detailsButton = getConversationActionsButton(page);
    const rail = page.getByTestId('chat-context-rail');
    await expect(rail).toBeVisible();
    await expect(rail.getByRole('heading', { name: 'Pinned messages' })).toBeVisible();
    await expect(rail.getByRole('heading', { name: 'Shared files' })).toBeVisible();
    await expect(rail.getByRole('heading', { name: 'Shared media' })).toBeVisible();

    await rail.getByRole('button', { name: 'Close conversation details' }).click();
    await expect(rail).toBeHidden();
    await expect(detailsButton).toBeFocused();
    await expect(page.getByTestId('chat-shell')).toHaveAttribute('data-right-rail', 'closed');
    await expectConversationReclaimsClosedRailSpace(page);

    await openConversationDetails(page);
    await expect(rail).toBeVisible();
    await expect(page.getByTestId('chat-shell')).toHaveAttribute('data-right-rail', 'open');
    await rail.getByRole('button', { name: 'Search messages' }).click();
    await expect(page.getByRole('textbox', { name: 'Search this conversation' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('textbox', { name: 'Search this conversation' })).toBeHidden();

    await expect(rail).toBeVisible();
    await rail.getByRole('button', { name: 'Search messages' }).focus();
    await page.keyboard.press('Escape');
    await expect(rail).toBeHidden();
    await expect(detailsButton).toBeFocused();
  });

  test('mobile detail drawer keeps close paths and search behavior', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPhase09Chat(page, { theme: 'light', chatId: PHASE09_PRIMARY_CHAT_ID });

    const detailsButton = await openConversationDetails(page);
    const detailsDialog = page.getByRole('dialog', { name: 'Conversation details' });
    await expect(detailsDialog).toBeVisible();
    await expect(detailsDialog.getByRole('heading', { name: 'Pinned messages' })).toBeVisible();
    await detailsDialog.getByRole('button', { name: 'Search messages' }).click();
    await expect(page.getByRole('textbox', { name: 'Search this conversation' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(detailsDialog).toBeHidden();
    await expect(detailsButton).toBeVisible();

    await page.setViewportSize({ width: 800, height: 844 });
    await openConversationDetails(page);
    await expect(detailsDialog).toBeVisible();
    await page.mouse.click(8, 8);
    await expect(detailsDialog).toBeHidden();
    await expect(detailsButton).toBeFocused();
  });
});
