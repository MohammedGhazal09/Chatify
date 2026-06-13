import path from 'node:path';
import { expect, test } from '@playwright/test';
import { PHASE07_PRIMARY_CHAT_ID, phase07BehaviorFixture } from './fixtures/phase07BehaviorFixture';
import { openPhase07Chat } from './pages/chatPage';

const phase13ArtifactPath = (fileName: string) => path.resolve(
  process.cwd(),
  '../../.planning/phases/13-realtime-call-and-video-implementation',
  fileName
);

test.describe('Phase 13 call smoke', () => {
  test('Phase 13 call visible control reports unavailable realtime honestly', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPhase07Chat(page, { theme: 'dark', chatId: PHASE07_PRIMARY_CHAT_ID });

    await expect(page.getByTestId('conversation-pane').getByRole('heading', {
      name: phase07BehaviorFixture.primaryTitle,
    })).toBeVisible();

    const callButton = page.getByRole('button', { name: 'Call' }).first();
    await expect(callButton).toBeVisible();
    await expect(callButton).toBeDisabled();
    await expect(callButton).toHaveAttribute(
      'title',
      /Calls are available only in direct chats|Realtime connection is unavailable|This person is offline|Calls require a supported secure browser/
    );
    await expect(page.getByRole('dialog', { name: 'Call controls' })).not.toBeVisible();

    await page.screenshot({ path: phase13ArtifactPath('13-call-unavailable-smoke.png') });
  });

  test('Phase 13 call live two-party fake-media happy path requires explicit smoke environment', async () => {
    test.skip(
      process.env.CHATIFY_CALL_SMOKE !== '1',
      'Set CHATIFY_CALL_SMOKE=1 with live backend, two authenticated accounts, and socket/TURN configuration for the production-like two-party call smoke.'
    );
  });
});
