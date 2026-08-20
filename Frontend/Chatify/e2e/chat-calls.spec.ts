import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PHASE07_PRIMARY_CHAT_ID, phase07BehaviorFixture } from './fixtures/phase07BehaviorFixture';
import { expectNoHorizontalOverflow, openPhase07Chat } from './pages/chatPage';
import {
  authenticatePhase15LocalContext,
  createPhase15LocalDirectChat,
  getPhase15LocalCallConfig,
  writePhase15BlockedLocalSetupReport,
  writePhase15CallAcceptanceReport,
  type Phase15CheckRow,
} from './pages/phase15CallAcceptance';

const phase13ArtifactPath = (fileName: string) => path.resolve(
  process.cwd(),
  '../../.planning/phases/13-realtime-call-and-video-implementation',
  fileName
);

const phase15ArtifactPath = (fileName: string) => path.resolve(
  process.cwd(),
  '../../.planning/phases/15-investigate-and-fix-audio-and-video-call-reliability',
  fileName
);

const phase15Command = 'npm run test:ui -- --grep "Phase 15"';

type EnabledPhase15Config = Extract<ReturnType<typeof getPhase15LocalCallConfig>, { enabled: true }>;

const gotoPhase15Chat = async (
  page: Page,
  config: EnabledPhase15Config,
  chatId: string,
  theme: 'dark' | 'light' = 'dark'
) => {
  await page.goto(`${config.frontendUrl}/?chatId=${chatId}&chatTheme=${theme}`);
  await expect(page.getByTestId('chat-root')).toHaveAttribute('data-chat-theme', theme, { timeout: 15000 });
  await expect(page.getByTestId('conversation-pane').getByRole('heading')).toBeVisible({ timeout: 15000 });
};

const dismissVisibleCallDialog = async (page: Page) => {
  if (page.isClosed()) {
    return;
  }

  const dialog = page.getByRole('dialog', { name: 'Call controls' });

  if (!(await dialog.isVisible().catch(() => false))) {
    return;
  }

  for (const buttonName of ['End call', 'Cancel call', 'Reject call']) {
    const button = dialog.getByRole('button', { name: buttonName }).first();

    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
      break;
    }
  }

  await expect(dialog).toBeHidden({ timeout: 10000 }).catch(() => undefined);
};

const cleanupPhase15CallState = async (...pages: Page[]) => {
  await Promise.all(pages.map((page) => dismissVisibleCallDialog(page)));
  await Promise.all(pages.map(async (page) => {
    if (!page.isClosed()) {
      await page.reload({ waitUntil: 'networkidle' }).catch(() => undefined);
      await expect(page.getByRole('dialog', { name: 'Call controls' })).toBeHidden({ timeout: 10000 }).catch(() => undefined);
    }
  }));
};

const exercisePhase15CallMode = async ({
  callee,
  caller,
  config,
  mode,
  selectedChatId,
}: {
  callee: Page;
  caller: Page;
  config: EnabledPhase15Config;
  mode: 'audio' | 'video';
  selectedChatId: string;
}) => {
  await caller.setViewportSize({ width: 1440, height: 900 });
  await callee.setViewportSize({ width: 1440, height: 900 });
  await gotoPhase15Chat(caller, config, selectedChatId);
  await gotoPhase15Chat(callee, config, selectedChatId);

  const buttonName = mode === 'audio' ? 'Call' : 'Video call';
  const callButton = caller.getByRole('button', { name: buttonName }).first();

  await expect(callButton).toBeVisible({ timeout: 10000 });
  await expect.poll(async () => callButton.isEnabled(), {
    timeout: 15000,
    message: `${buttonName} should become enabled while both Phase 15 local contexts are online.`,
  }).toBeTruthy();

  let cleanupNeeded = false;

  try {
    await callButton.click();
    cleanupNeeded = true;

    const callerDialog = caller.getByRole('dialog', { name: 'Call controls' });
    const calleeDialog = callee.getByRole('dialog', { name: 'Call controls' });

    await expect(callerDialog.getByText(/Calling|Connecting/)).toBeVisible({ timeout: 15000 });
    await expect(calleeDialog.getByText(new RegExp(`Incoming ${mode} call`, 'i'))).toBeVisible({ timeout: 20000 });
    await calleeDialog.getByRole('button', { name: 'Accept call' }).click();
    await expect(callerDialog.getByText(/Connected with/i)).toBeVisible({ timeout: 30000 });
    await expect(calleeDialog.getByText(/Connected with/i)).toBeVisible({ timeout: 30000 });

    if (mode === 'video') {
      await expect(callerDialog.locator('video[aria-label="Local preview"]')).toBeVisible();
      await expect(calleeDialog.locator('video[aria-label="Local preview"]')).toBeVisible();
    }

    const screenshotPath = phase15ArtifactPath(`15-local-${mode}-connected.png`);
    await caller.screenshot({ path: screenshotPath });
    await callerDialog.getByRole('button', { name: 'End call' }).click();
    await expect(callerDialog).toBeHidden({ timeout: 20000 });
    await expect(calleeDialog).toBeHidden({ timeout: 20000 });
    await caller.reload({ waitUntil: 'networkidle' });
    await callee.reload({ waitUntil: 'networkidle' });
    await expect(caller.getByRole('dialog', { name: 'Call controls' })).toBeHidden({ timeout: 10000 });
    await expect(callee.getByRole('dialog', { name: 'Call controls' })).toBeHidden({ timeout: 10000 });
    cleanupNeeded = false;

    return {
      detail: `${buttonName} completed outgoing, incoming, accepted, connected, ended, and reload-cleanup states.`,
      evidencePath: screenshotPath,
    };
  } finally {
    if (cleanupNeeded) {
      await cleanupPhase15CallState(caller, callee).catch(() => undefined);
    }
  }
};

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
      /Calls are available only in direct chats|Realtime connection is not ready for calls|This person is online but not reachable for calls yet|Both users must be online to call|Calls require a supported secure browser/
    );
    await expect(page.getByRole('dialog', { name: 'Call controls' })).not.toBeVisible();

    await page.screenshot({ path: phase13ArtifactPath('13-call-unavailable-smoke.png') });
  });

  test('Phase 13 mobile call controls explain unavailable realtime', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPhase07Chat(page, { theme: 'dark', chatId: PHASE07_PRIMARY_CHAT_ID });

    await expect(page.getByTestId('conversation-pane').getByRole('heading', {
      name: phase07BehaviorFixture.primaryTitle,
    })).toBeVisible();

    await page.getByRole('button', { name: 'More conversation actions' }).first().click();
    const menu = page.getByRole('menu', { name: 'Conversation actions' });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Call', exact: true })).toBeDisabled();
    await expect(menu.getByRole('menuitem', { name: 'Video call', exact: true })).toBeDisabled();
    await expect(menu.getByText(/Calls are available only in direct chats|Realtime connection is not ready for calls|Both users must be online to call|Calls require a supported secure browser/).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: phase13ArtifactPath('13-ui-review-mobile-menu-call-unavailable.png') });

    await menu.getByRole('menuitem', { name: 'Conversation details' }).click();
    const dialog = page.getByRole('dialog', { name: 'Conversation details' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Call', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Video call', exact: true })).toBeDisabled();
    await expect(dialog.getByText(/Calls unavailable:|Call unavailable:/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: phase13ArtifactPath('13-ui-review-mobile-details-call-unavailable.png') });
  });

  test('Phase 13 call live two-party fake-media happy path requires explicit smoke environment', async () => {
    test.skip(
      process.env.CHATIFY_CALL_SMOKE !== '1',
      'Set CHATIFY_CALL_SMOKE=1 with live backend, two authenticated accounts, and socket/TURN configuration for the production-like two-party call smoke.'
    );
  });
});

test.describe('Phase 15 local call acceptance', () => {
  test('Phase 15 local two-account fake-media audio and video calls', async ({ browser }) => {
    const config = getPhase15LocalCallConfig();

    if (!config.enabled) {
      writePhase15BlockedLocalSetupReport(phase15Command);
      test.skip(true, config.blockedReason);
      return;
    }

    const senderContext = await browser.newContext({ permissions: ['microphone', 'camera'] });
    const recipientContext = await browser.newContext({ permissions: ['microphone', 'camera'] });
    const checks: Phase15CheckRow[] = [];
    const blockers: string[] = [];
    const evidencePaths: string[] = [];

    try {
      const senderAuth = await authenticatePhase15LocalContext({
        account: config.accounts.sender,
        backendUrl: config.backendUrl,
        context: senderContext,
      });
      await authenticatePhase15LocalContext({
        account: config.accounts.recipient,
        backendUrl: config.backendUrl,
        context: recipientContext,
      });
      const selectedChatId = await createPhase15LocalDirectChat({
        auth: senderAuth,
        backendUrl: config.backendUrl,
        targetEmail: config.accounts.recipient.email,
      });
      const caller = await senderContext.newPage();
      const callee = await recipientContext.newPage();

      for (const mode of ['audio', 'video'] as const) {
        const result = await exercisePhase15CallMode({
          callee,
          caller,
          config,
          mode,
          selectedChatId,
        });

        checks.push({
          name: `Local ${mode} call behavior`,
          status: 'passed',
          detail: result.detail,
        });
        evidencePaths.push(result.evidencePath);
      }

      await caller.setViewportSize({ width: 390, height: 844 });
      await gotoPhase15Chat(caller, config, selectedChatId);
      await expectNoHorizontalOverflow(caller);
      await expect(caller.getByRole('dialog', { name: 'Call controls' })).toBeHidden();
      const mobileEvidencePath = phase15ArtifactPath('15-local-mobile-call-cleanup.png');
      await caller.screenshot({ path: mobileEvidencePath });
      evidencePaths.push(mobileEvidencePath);

      writePhase15CallAcceptanceReport({
        checks,
        command: phase15Command,
        config,
        evidencePaths,
        status: 'local_ready',
        risks: [
          'Production call readiness still requires configured production smoke and TURN evidence.',
        ],
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown Phase 15 local call acceptance failure.';
      blockers.push(detail);
      checks.push({
        name: 'Phase 15 local two-account call acceptance',
        status: 'failed',
        detail,
      });
      writePhase15CallAcceptanceReport({
        blockers,
        checks,
        command: phase15Command,
        config,
        evidencePaths,
        status: 'failed',
      });
      throw error;
    } finally {
      await senderContext.close();
      await recipientContext.close();
    }
  });
});
