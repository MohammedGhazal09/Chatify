import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  appendProductionDeliveryReliabilityAudit,
  getProductionSmokeConfig,
  makeDeliverySmokeMessageText,
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
  await expect(page.getByRole('textbox', { name: 'Write a private message' })).toBeVisible({ timeout: 20000 });
};

const createSmokePage = async (browser: Browser) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  return { context, page };
};

const markerRows = (page: Page, marker: string) => page.locator('[data-message-id]').filter({ hasText: marker });

const sendMarker = async (page: Page, marker: string) => {
  const createResponse = page.waitForResponse((response) => (
    response.url().includes('/api/message/new-message') &&
    response.request().method() === 'POST' &&
    response.status() < 500
  ));

  await page.getByRole('textbox', { name: 'Write a private message' }).fill(marker);
  await page.getByRole('button', { name: 'Send message' }).click();

  const response = await createResponse;
  const body = await response.json();

  expect(response.ok(), 'message create should succeed').toBe(true);
  expect(body.data.message.status, 'HTTP create response must not claim recipient delivery').toBe('sent');
  await expect(markerRows(page, marker)).toHaveCount(1, { timeout: 20000 });
};

const describeSmokeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.name || 'Error';
  }

  return 'Unknown error';
};

const appendDeliveryRunAudit = ({
  observations,
  status,
}: {
  observations: string[];
  status: 'passed' | 'failed';
}) => {
  const config = requireProductionSmokeConfig();
  appendProductionDeliveryReliabilityAudit(`
## Automated Production Delivery Smoke Run

- Status: ${status}
- Frontend origin: ${config.metadata.frontendOrigin}
- Backend origin: ${config.metadata.backendOrigin}
- Accounts: ${config.metadata.accounts.map((account) => `${account.label} (${account.redactedEmail})`).join(', ')}
- Smoke marker: redacted unique Phase 10.1 marker
- Observations:
${observations.map((observation) => `  - ${observation}`).join('\n')}
`);
};

test.describe('Phase 10.1 production delivery reliability', () => {
  test.skip(!initialConfig.enabled, initialConfig.enabled ? undefined : initialConfig.blockedReason);

  test('live two-account delivery without local fixture traffic', async ({ browser }) => {
    const config = requireProductionSmokeConfig();
    const marker = makeDeliverySmokeMessageText();
    const sender = await createSmokePage(browser);
    const recipient = await createSmokePage(browser);
    const observations: string[] = [];
    let auditAppended = false;

    try {
      await signIn(sender.page, config.frontendUrl, config.accounts.sender);
      await startOrContinueChat(sender.page, config.accounts.recipient.email);
      await signIn(recipient.page, config.frontendUrl, config.accounts.recipient);
      await startOrContinueChat(recipient.page, config.accounts.sender.email);

      await sendMarker(sender.page, marker);
      const senderBubbleCount = await markerRows(sender.page, marker).count();
      observations.push(`Sender marker count after send: ${senderBubbleCount}.`);

      let recipientSawMarkerWithoutRefresh = false;
      let recipientMarkerCountAfterRefresh: number | null = null;

      try {
        await expect(markerRows(recipient.page, marker)).toHaveCount(1, { timeout: 15000 });
        recipientSawMarkerWithoutRefresh = true;
        observations.push('Recipient saw marker without refresh: yes.');
      } catch {
        observations.push('Recipient saw marker without refresh: no.');
        await recipient.page.reload({ waitUntil: 'networkidle' });
        recipientMarkerCountAfterRefresh = await markerRows(recipient.page, marker).count();
        observations.push(`Recipient marker count after refresh: ${recipientMarkerCountAfterRefresh}.`);
      }

      await sender.page.reload({ waitUntil: 'networkidle' });
      const senderCountAfterRefresh = await markerRows(sender.page, marker).count();
      observations.push(`Sender marker count after refresh: ${senderCountAfterRefresh}.`);

      const deliveryPassed = senderBubbleCount === 1 &&
        recipientSawMarkerWithoutRefresh &&
        recipientMarkerCountAfterRefresh === null &&
        senderCountAfterRefresh === 1;
      observations.push(`Delivery reliability status: ${deliveryPassed ? 'passed' : 'failed'}.`);

      appendDeliveryRunAudit({
        observations,
        status: deliveryPassed ? 'passed' : 'failed',
      });
      auditAppended = true;

      expect(deliveryPassed).toBe(true);
    } catch (error) {
      if (!auditAppended) {
        observations.push(`Run failed before completion: ${describeSmokeError(error)}.`);
        appendDeliveryRunAudit({
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
