import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  appendProductionSmokeAudit,
  getProductionSmokeConfig,
  makeSmokeMessageText,
  requireProductionSmokeConfig,
  type ProductionSmokeAccount,
} from './pages/productionSmoke';

const initialConfig = getProductionSmokeConfig();

const signIn = async (page: Page, frontendUrl: string, account: ProductionSmokeAccount) => {
  await page.goto(`${frontendUrl}/login`, { waitUntil: 'networkidle' });

  if (await page.getByTestId('chat-root').count()) {
    return;
  }

  await page.getByLabel('Email Address').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByTestId('chat-root')).toBeVisible({ timeout: 30000 });
};

const startOrContinueChat = async (page: Page, targetEmail: string) => {
  await page.getByRole('button', { name: 'Start new chat' }).click();
  const dialog = page.getByRole('dialog', { name: 'New chat' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Email address').fill(targetEmail);
  await dialog.getByRole('button', { name: 'Start or continue chat' }).click();
  await expect(dialog).toBeHidden({ timeout: 20000 });
  await expect(page.getByTestId('conversation-pane').getByRole('heading')).toBeVisible({ timeout: 20000 });
};

const openDetailsAndVerifyTruthfulControls = async (page: Page) => {
  const detailsButton = page.getByRole('button', { name: 'Open conversation details' });
  await detailsButton.click();

  const rail = page.getByTestId('chat-context-rail');
  if (await rail.isVisible().catch(() => false)) {
    await expect(rail.getByText('Pinned messages')).toBeVisible();
    await expect(rail.getByText('Shared files')).toBeVisible();
    await expect(rail.getByText('Shared media')).toBeVisible();
    await expect(rail.getByRole('button', { name: 'Search messages' })).toBeEnabled();
    await expect(rail.getByRole('button', { name: 'More conversation actions' })).toBeDisabled();
    await rail.getByRole('button', { name: 'Close conversation details' }).click();
    await expect(rail).toBeHidden();
    await expect(detailsButton).toBeFocused();
    await detailsButton.click();
    await expect(rail).toBeVisible();
    return 'desktop-rail';
  }

  const drawer = page.getByRole('dialog', { name: 'Conversation details' });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText('Pinned messages')).toBeVisible();
  await expect(drawer.getByText('Shared files')).toBeVisible();
  await expect(drawer.getByText('Shared media')).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Search messages' })).toBeEnabled();
  await expect(drawer.getByRole('button', { name: 'More conversation actions' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(detailsButton).toBeFocused();

  return 'mobile-drawer';
};

const sendSmokeMessage = async (page: Page, text: string) => {
  const composer = page.getByRole('textbox', { name: 'Write a private message' });
  await composer.fill(text);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByTestId('conversation-pane').getByText(text).first()).toBeVisible({ timeout: 20000 });
};

const createSmokePage = async (browser: Browser) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  return { context, page };
};

const describeSmokeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.name || 'Error';
  }

  return 'Unknown error';
};

const appendSmokeRunAudit = ({
  config,
  observations,
  status,
}: {
  config: ReturnType<typeof requireProductionSmokeConfig>;
  observations: string[];
  status: 'passed' | 'failed';
}) => {
  appendProductionSmokeAudit(`
## Automated Production Smoke Run

- Status: ${status}
- Frontend origin: ${config.metadata.frontendOrigin}
- Backend origin: ${config.metadata.backendOrigin}
- Accounts: ${config.metadata.accounts.map((account) => `${account.label} (${account.redactedEmail})`).join(', ')}
- Smoke marker: redacted unique Phase 10 marker
- Observations:
${observations.map((observation) => `  - ${observation}`).join('\n')}
`);
};

test.describe('Phase 10 production smoke', () => {
  test.skip(!initialConfig.enabled, initialConfig.enabled ? undefined : initialConfig.blockedReason);

  test('live two-account messenger audit without local fixture traffic', async ({ browser }) => {
    const config = requireProductionSmokeConfig();
    const marker = makeSmokeMessageText();
    const sender = await createSmokePage(browser);
    const recipient = await createSmokePage(browser);
    const observations: string[] = [];
    let auditAppended = false;

    try {
      await signIn(sender.page, config.frontendUrl, config.accounts.sender);
      await startOrContinueChat(sender.page, config.accounts.recipient.email);
      const detailSurface = await openDetailsAndVerifyTruthfulControls(sender.page);
      observations.push(`Detail surface verified: ${detailSurface}.`);

      await signIn(recipient.page, config.frontendUrl, config.accounts.recipient);
      await startOrContinueChat(recipient.page, config.accounts.sender.email);

      await sendSmokeMessage(sender.page, marker);

      const senderBubbleCount = await sender.page.getByTestId('conversation-pane').getByText(marker).count();
      observations.push(`Sender message bubble count for marker: ${senderBubbleCount}.`);
      let recipientSawMarkerWithoutRefresh = false;
      let recipientMarkerCountAfterRefresh: number | null = null;

      try {
        await expect(recipient.page.getByTestId('conversation-pane').getByText(marker).first()).toBeVisible({ timeout: 15000 });
        recipientSawMarkerWithoutRefresh = true;
        observations.push('Recipient saw marker without refresh: yes.');
      } catch {
        observations.push('Recipient saw marker without refresh: no.');
        await recipient.page.reload({ waitUntil: 'networkidle' });
        recipientMarkerCountAfterRefresh = await recipient.page.getByTestId('conversation-pane').getByText(marker).count();
        observations.push(`Recipient marker count after refresh: ${recipientMarkerCountAfterRefresh}.`);
      }

      const deliveryPassed = senderBubbleCount === 1 && recipientSawMarkerWithoutRefresh;
      observations.push(`Delivery baseline status: ${deliveryPassed ? 'passed' : 'failed'}.`);
      appendSmokeRunAudit({
        config,
        observations,
        status: deliveryPassed ? 'passed' : 'failed',
      });
      auditAppended = true;

      expect(senderBubbleCount).toBe(1);
      expect(recipientSawMarkerWithoutRefresh).toBe(true);
      expect(recipientMarkerCountAfterRefresh).toBeNull();
    } catch (error) {
      if (!auditAppended) {
        observations.push(`Run failed before completion: ${describeSmokeError(error)}.`);
        appendSmokeRunAudit({
          config,
          observations,
          status: 'failed',
        });
      }

      throw error;
    } finally {
      await sender.context.close();
      await recipient.context.close();
    }
  });
});
