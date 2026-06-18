import { expect, test } from '@playwright/test';
import path from 'node:path';
import { PHASE09_PRIMARY_CHAT_ID } from './fixtures/phase09QualityGateFixture';
import { expectNoForbiddenUserFacingEvidence, openPhase09Chat } from './pages/chatPage';

const phase12ArtifactPath = (fileName: string) => path.resolve(
  process.cwd(),
  '../../.planning/phases/12-live-media-voice-and-identity-implementation',
  fileName
);

test.describe('Phase 12 live media and voice', () => {
  test('renders persisted voice assets from protected attachment routes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPhase09Chat(page, { theme: 'light', chatId: PHASE09_PRIMARY_CHAT_ID });

    const rail = page.getByTestId('chat-context-rail');
    await expect(rail).toBeVisible();
    await expect(rail.getByRole('heading', { name: 'Voice messages' })).toBeVisible();
    await expect(rail.getByText('phase12-relay-check-in.webm')).toBeVisible();

    await expect(rail.getByRole('button', { name: 'Play phase12-relay-check-in.webm' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Download phase12-relay-check-in.webm' })).toHaveAttribute(
      'href',
      /\/api\/message\/attachments\/phase12-attachment-relay-voice\/download$/
    );

    const audio = rail.locator('audio[src$="/api/message/attachments/phase12-attachment-relay-voice/preview"]');
    await expect(audio).toHaveAttribute('crossorigin', 'use-credentials');
    await expectNoForbiddenUserFacingEvidence(page);
    await page.screenshot({ path: phase12ArtifactPath('12-ui-review-desktop-voice.png') });
    await rail.locator('.overflow-y-auto').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(rail.getByRole('heading', { name: 'Voice messages' })).toBeInViewport();
    await page.screenshot({ path: phase12ArtifactPath('12-ui-review-desktop-voice-scrolled.png') });
  });

  test('keeps persisted voice assets usable in the mobile detail drawer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPhase09Chat(page, { theme: 'light', chatId: PHASE09_PRIMARY_CHAT_ID });

    await page.getByRole('button', { name: 'More conversation actions' }).first().click();
    await page
      .getByRole('menu', { name: 'Conversation actions' })
      .getByRole('menuitem', { name: 'Conversation details' })
      .click();

    const dialog = page.getByRole('dialog', { name: 'Conversation details' });
    await expect(dialog).toBeVisible();
    await dialog.locator('.overflow-y-auto').evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(dialog.getByRole('heading', { name: 'Voice messages' })).toBeInViewport();
    await expect(dialog.getByText('phase12-relay-check-in.webm')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Download phase12-relay-check-in.webm' })).toHaveAttribute(
      'href',
      /\/api\/message\/attachments\/phase12-attachment-relay-voice\/download$/
    );
    await page.screenshot({ path: phase12ArtifactPath('12-ui-review-mobile-voice.png') });
  });
});
