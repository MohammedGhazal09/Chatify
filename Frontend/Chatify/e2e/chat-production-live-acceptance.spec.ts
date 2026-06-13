import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import {
  authenticateProductionSmokeContext,
  type ProductionSmokeAccount,
} from './pages/productionSmoke';
import {
  findPhase14StaticContentLeaks,
  getPhase14ProductionAcceptanceConfig,
  writePhase14LiveAcceptanceReport,
  type Phase14CheckRow,
  type Phase14ProductionAcceptanceConfig,
} from './pages/phase14ProductionAcceptance';

const phase14RunCommand = 'npm run test:e2e:prod -- --grep "Phase 14 production live acceptance"';
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p94AAAAASUVORK5CYII=',
  'base64'
);

type EnabledPhase14Config = Extract<Phase14ProductionAcceptanceConfig, { enabled: true }>;
type Phase14Page = {
  context: BrowserContext;
  page: Page;
  label: string;
};

type AttachmentEvidence = {
  marker: string;
  textFileName: string;
  imageFileName: string;
};

const markerRows = (page: Page, marker: string) => page.locator('[data-message-id]').filter({ hasText: marker });

const describeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message || error.name;
  }

  return 'Unknown error';
};

const describeBlockedRunError = (error: unknown) => {
  if (error instanceof Error) {
    return error.name || 'Error';
  }

  return 'Unknown error';
};

const makePhase14Marker = (label: string) => `phase14 ${label} ${new Date().toISOString()} ${Math.random().toString(36).slice(2, 8)}`;

const getSelectedChatId = (page: Page) => {
  try {
    return new URL(page.url()).searchParams.get('chatId');
  } catch {
    return null;
  }
};

const appendObservation = (observations: string[], value: string) => {
  if (observations.length < 80) {
    observations.push(value);
  }
};

const installNetworkObservations = (page: Page, label: string, config: EnabledPhase14Config, observations: string[]) => {
  const backendOrigin = new URL(config.backendUrl).origin;

  page.on('response', (response) => {
    const url = new URL(response.url());

    if (url.origin !== backendOrigin || (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/socket.io/'))) {
      return;
    }

    const trafficKind = url.pathname.startsWith('/socket.io/') ? 'socket' : 'api';
    appendObservation(observations, `${label}: ${trafficKind} ${response.request().method()} ${url.origin}${url.pathname} -> ${response.status()}`);
  });

  page.on('websocket', (webSocket) => {
    const url = new URL(webSocket.url());

    if (url.origin === backendOrigin) {
      appendObservation(observations, `${label}: websocket ${url.origin}${url.pathname}`);
    }
  });

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      appendObservation(observations, `${label}: console ${message.type()} - ${message.text().slice(0, 160)}`);
    }
  });
};

const recordCheck = async ({
  blockers,
  checks,
  name,
  run,
}: {
  blockers: string[];
  checks: Phase14CheckRow[];
  name: string;
  run: () => Promise<string | void>;
}) => {
  try {
    const detail = await run();
    checks.push({
      name,
      status: 'passed',
      detail: detail ?? 'Verified.',
    });
  } catch (error) {
    const detail = describeError(error);
    blockers.push(`${name}: ${detail}`);
    checks.push({
      name,
      status: 'failed',
      detail,
    });
  }
};

const createPhase14Page = async (
  browser: Browser,
  config: EnabledPhase14Config,
  account: ProductionSmokeAccount,
  observations: string[]
): Promise<Phase14Page> => {
  const context = await browser.newContext();

  try {
    await authenticateProductionSmokeContext({
      account,
      backendUrl: config.backendUrl,
      context,
    });

    const page = await context.newPage();
    installNetworkObservations(page, account.label, config, observations);
    await page.goto(`${config.frontendUrl}/?chatTheme=dark`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('chat-root')).toBeVisible({ timeout: 30000 });
    const backendCookies = await context.cookies(config.backendUrl);
    const cookieSummary = backendCookies
      .map((cookie) => `${cookie.name}(secure=${cookie.secure},httpOnly=${cookie.httpOnly},sameSite=${cookie.sameSite ?? 'Unset'})`)
      .join(', ');

    appendObservation(
      observations,
      `${account.label}: auth cookie metadata ${cookieSummary || 'none'}`
    );

    return {
      context,
      page,
      label: account.label,
    };
  } catch (error) {
    await context.close().catch(() => undefined);
    throw error;
  }
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

const waitForCreateMessageResponse = (page: Page) => (
  page.waitForResponse((response) => (
    response.url().includes('/api/message/new-message') &&
    response.request().method() === 'POST' &&
    response.status() < 500
  ))
);

const sendTextMarker = async (page: Page, marker: string) => {
  const createResponse = waitForCreateMessageResponse(page);

  await page.getByRole('textbox', { name: 'Write a private message' }).fill(marker);
  await page.getByRole('button', { name: 'Send message' }).click();

  const response = await createResponse;
  const body = await response.json();

  expect(response.ok(), 'message create should succeed').toBe(true);
  expect(body.data.message.status, 'HTTP create response must not claim recipient delivery').toBe('sent');
  await expect(markerRows(page, marker)).toHaveCount(1, { timeout: 20000 });

  return `HTTP create status ${body.data.message.status}; exactly one sender bubble.`;
};

const verifyRecipientRealtimeAndReload = async (sender: Page, recipient: Page, marker: string) => {
  await expect(markerRows(recipient, marker)).toHaveCount(1, { timeout: 20000 });
  await sender.reload({ waitUntil: 'networkidle' });
  await recipient.reload({ waitUntil: 'networkidle' });
  await expect(markerRows(sender, marker)).toHaveCount(1, { timeout: 20000 });
  await expect(markerRows(recipient, marker)).toHaveCount(1, { timeout: 20000 });

  return 'Recipient saw the marker without refresh; sender and recipient each kept exactly one marker after reload.';
};

const openMoreMenu = async (page: Page) => {
  const moreButton = page.getByRole('button', { name: 'More conversation actions' }).first();
  await moreButton.click();
  const menu = page.getByRole('menu', { name: 'Conversation actions' });
  await expect(menu).toBeVisible({ timeout: 10000 });
  return { menu, moreButton };
};

const openDesktopDetailRail = async (page: Page) => {
  const rail = page.getByTestId('chat-context-rail');

  if (await rail.isVisible().catch(() => false)) {
    return rail;
  }

  const { menu } = await openMoreMenu(page);
  await menu.getByRole('menuitem', { name: 'Conversation details' }).click();
  await expect(rail).toBeVisible({ timeout: 10000 });
  return rail;
};

const exerciseDesktopDetails = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const rail = await openDesktopDetailRail(page);
  await expect(rail.getByRole('heading', { name: 'Pinned messages' })).toBeVisible();
  await expect(rail.getByRole('heading', { name: 'Shared files' })).toBeVisible();
  await expect(rail.getByRole('heading', { name: 'Shared media' })).toBeVisible();
  await expect(rail.getByText('Authenticated session')).toBeVisible();

  const moreButton = page.getByRole('button', { name: 'More conversation actions' }).first();
  await rail.getByRole('button', { name: 'Close conversation details' }).click();
  await expect(rail).toBeHidden({ timeout: 10000 });
  await expect(moreButton).toBeFocused();
  await expect(page.getByTestId('chat-shell')).toHaveAttribute('data-right-rail', 'closed');

  const { menu } = await openMoreMenu(page);
  await menu.getByRole('menuitem', { name: 'Conversation details' }).click();
  await expect(rail).toBeVisible({ timeout: 10000 });

  return 'Desktop rail closes, returns focus, and reopens from More.';
};

const exerciseMobileDetails = async (page: Page, config: EnabledPhase14Config, chatId: string | null) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoChatVariant(page, config, chatId, 'light');

  const { menu, moreButton } = await openMoreMenu(page);
  await menu.getByRole('menuitem', { name: 'Conversation details' }).click();
  const dialog = page.getByRole('dialog', { name: 'Conversation details' });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByRole('heading', { name: 'Pinned messages' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden({ timeout: 10000 });
  await expect(moreButton).toBeFocused();

  await moreButton.click();
  await page.getByRole('menu', { name: 'Conversation actions' }).getByRole('menuitem', { name: 'Conversation details' }).click();
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await dialog.getByRole('button', { name: 'Close conversation details' }).click();
  await expect(dialog).toBeHidden({ timeout: 10000 });

  return 'Mobile drawer opens, Escape closes, focus returns, and close button works.';
};

const exerciseMoreMenu = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { menu, moreButton } = await openMoreMenu(page);
  await expect(menu.getByRole('menuitem', { name: 'Conversation details' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Search messages' })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: 'Export chat' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden({ timeout: 10000 });
  await expect(moreButton).toBeFocused();

  await moreButton.click();
  await expect(menu).toBeVisible({ timeout: 10000 });
  await page.mouse.click(8, 8);
  await expect(menu).toBeHidden({ timeout: 10000 });

  return 'More menu exposes real actions and dismisses by Escape and outside click.';
};

const exerciseMessageSearch = async (page: Page, marker: string) => {
  const searchButton = page.getByRole('button', { name: 'Search messages' }).first();
  await searchButton.click();
  const searchInput = page.getByRole('textbox', { name: 'Search this conversation' });
  await expect(searchInput).toBeFocused();
  await searchInput.fill(marker.slice(0, 24));
  await expect(page.getByRole('button', { name: new RegExp(`Jump to message .*${escapeRegExp(marker.slice(0, 24))}`) })).toBeVisible({ timeout: 15000 });
  await page.keyboard.press('Escape');
  await expect(searchInput).toBeHidden({ timeout: 10000 });
  await expect(searchButton).toBeFocused();

  return 'Search returned the current live marker and dismissed cleanly.';
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const exerciseUnsupportedControls = async (page: Page) => {
  const voiceButton = page.getByRole('button', { name: 'Voice message unavailable in this phase' });
  if (await voiceButton.count()) {
    await expect(voiceButton).toBeDisabled();
    await expect(voiceButton).toHaveAttribute('title', /unavailable/i);
  }

  const disabledCallButtons = await page.getByRole('button', { name: 'Call' }).evaluateAll((buttons) => (
    buttons.filter((button) => button.hasAttribute('disabled')).length
  ));
  const enabledCallButtons = await page.getByRole('button', { name: 'Call' }).evaluateAll((buttons) => (
    buttons.filter((button) => !button.hasAttribute('disabled')).length
  ));
  const disabledVideoButtons = await page.getByRole('button', { name: 'Video call' }).evaluateAll((buttons) => (
    buttons.filter((button) => button.hasAttribute('disabled')).length
  ));
  const enabledVideoButtons = await page.getByRole('button', { name: 'Video call' }).evaluateAll((buttons) => (
    buttons.filter((button) => !button.hasAttribute('disabled')).length
  ));

  return `Voice unavailable state verified when present. Call controls enabled=${enabledCallButtons}, disabled=${disabledCallButtons}; video enabled=${enabledVideoButtons}, disabled=${disabledVideoButtons}.`;
};

const isAcceptableCallDisabledReason = (reason: string) => (
  /supported secure browser|camera access is not available/i.test(reason)
);

const exerciseCallMode = async ({
  callee,
  caller,
  config,
  mode,
  selectedChatId,
}: {
  callee: Page;
  caller: Page;
  config: EnabledPhase14Config;
  mode: 'audio' | 'video';
  selectedChatId: string | null;
}) => {
  await caller.setViewportSize({ width: 1440, height: 900 });
  await callee.setViewportSize({ width: 1440, height: 900 });
  await gotoChatVariant(caller, config, selectedChatId, 'dark');
  await gotoChatVariant(callee, config, selectedChatId, 'dark');

  const buttonName = mode === 'audio' ? 'Call' : 'Video call';
  const callButton = caller.getByRole('button', { name: buttonName }).first();
  await expect(callButton).toBeVisible({ timeout: 10000 });

  await expect.poll(async () => callButton.isEnabled(), {
    timeout: 10000,
    message: `${buttonName} should become enabled while both production smoke contexts are online.`,
  }).toBeTruthy().catch(() => undefined);

  if (!(await callButton.isEnabled())) {
    const reason = await callButton.getAttribute('title');
    expect(reason, `${buttonName} disabled controls must expose an accessible reason`).toBeTruthy();

    if (reason && isAcceptableCallDisabledReason(reason)) {
      return `${buttonName} is honestly unavailable in this browser context: ${reason}`;
    }

    throw new Error(`${buttonName} stayed disabled during two-account live acceptance: ${reason ?? 'no reason'}`);
  }

  await callButton.click();
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

  await callerDialog.getByRole('button', { name: 'End call' }).click();
  await expect(callerDialog).toBeHidden({ timeout: 20000 });
  await expect(calleeDialog).toBeHidden({ timeout: 20000 });
  await caller.reload({ waitUntil: 'networkidle' });
  await callee.reload({ waitUntil: 'networkidle' });
  await expect(caller.getByRole('dialog', { name: 'Call controls' })).toBeHidden({ timeout: 10000 });
  await expect(callee.getByRole('dialog', { name: 'Call controls' })).toBeHidden({ timeout: 10000 });

  return `${buttonName} completed outgoing, incoming, accepted, connected, ended, and reload-cleanup states.`;
};

const exerciseBlockAndRestore = async (page: Page) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const composer = page.getByRole('textbox', { name: 'Write a private message' });
  let restored = false;

  try {
    const { menu } = await openMoreMenu(page);
    const unblockItem = menu.getByRole('menuitem', { name: 'Unblock user' });
    if (await unblockItem.isVisible().catch(() => false)) {
      await expect(unblockItem).toBeEnabled();
      await unblockItem.click();
      await expect(composer).toBeEnabled({ timeout: 15000 });
    }

    const { menu: blockMenu } = await openMoreMenu(page);
    await blockMenu.getByRole('menuitem', { name: 'Block user' }).click();
    await expect(composer).toBeDisabled({ timeout: 15000 });

    const { menu: restoreMenu } = await openMoreMenu(page);
    const restoreItem = restoreMenu.getByRole('menuitem', { name: 'Unblock user' });
    await expect(restoreItem).toBeVisible({ timeout: 15000 });
    await expect(restoreItem).toBeEnabled();
    await restoreItem.click();
    await expect(composer).toBeEnabled({ timeout: 15000 });
    restored = true;

    return 'Block action disabled the composer and unblock restored messaging.';
  } finally {
    if (!restored) {
      await restoreUnblockedState(page).catch(() => undefined);
    }
  }
};

const restoreUnblockedState = async (page: Page) => {
  const { menu } = await openMoreMenu(page);
  const unblockItem = menu.getByRole('menuitem', { name: 'Unblock user' });

  if (await unblockItem.isVisible().catch(() => false)) {
    await unblockItem.click();
    await expect(page.getByRole('textbox', { name: 'Write a private message' })).toBeEnabled({ timeout: 15000 });
  } else {
    await page.keyboard.press('Escape');
  }
};

const makeAttachmentFixtures = (marker: string) => {
  const suffix = marker.split(' ').at(-1) ?? Date.now().toString();

  return {
    textFileName: `phase14-live-${suffix}.txt`,
    imageFileName: `phase14-live-${suffix}.png`,
    textFile: {
      name: `phase14-live-${suffix}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(`Phase 14 live acceptance fixture for ${marker}.`, 'utf8'),
    },
    imageFile: {
      name: `phase14-live-${suffix}.png`,
      mimeType: 'image/png',
      buffer: tinyPng,
    },
  };
};

const sendAttachmentMessage = async (sender: Page, recipient: Page, marker: string): Promise<AttachmentEvidence> => {
  const fixtures = makeAttachmentFixtures(marker);
  const fileInput = sender.locator('input[type="file"][aria-label="Attach file"]');

  await fileInput.setInputFiles([fixtures.textFile, fixtures.imageFile]);
  await expect(sender.getByTestId('attachment-tray').getByText(fixtures.textFileName)).toBeVisible();
  await expect(sender.getByTestId('attachment-tray').getByText(fixtures.imageFileName)).toBeVisible();

  const createResponse = waitForCreateMessageResponse(sender);
  await sender.getByRole('textbox', { name: 'Write a private message' }).fill(marker);
  await sender.getByRole('button', { name: 'Send message' }).click();

  const response = await createResponse;
  const body = await response.json();

  expect(response.ok(), 'attachment message create should succeed').toBe(true);
  expect(body.data.message.status, 'attachment HTTP create response must not claim recipient delivery').toBe('sent');
  expect(body.data.message.attachments?.length ?? 0, 'attachment response should include generated files').toBeGreaterThanOrEqual(2);
  await expect(markerRows(sender, marker)).toHaveCount(1, { timeout: 20000 });
  await expect(sender.getByTestId('conversation-pane').getByText(fixtures.textFileName).first()).toBeVisible({ timeout: 20000 });
  await expect(sender.getByTestId('conversation-pane').getByText(fixtures.imageFileName).first()).toBeVisible({ timeout: 20000 });
  await expect(markerRows(recipient, marker)).toHaveCount(1, { timeout: 20000 });
  await expect(recipient.getByTestId('conversation-pane').getByText(fixtures.textFileName).first()).toBeVisible({ timeout: 20000 });
  await expect(recipient.getByTestId('conversation-pane').getByText(fixtures.imageFileName).first()).toBeVisible({ timeout: 20000 });

  return {
    marker,
    textFileName: fixtures.textFileName,
    imageFileName: fixtures.imageFileName,
  };
};

const verifySharedSurfaces = async (page: Page, config: EnabledPhase14Config, chatId: string | null, evidence: AttachmentEvidence) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await gotoChatVariant(page, config, chatId, 'dark');
  await expect(markerRows(page, evidence.marker)).toHaveCount(1, { timeout: 20000 });
  const rail = await openDesktopDetailRail(page);

  await expect(rail.getByRole('heading', { name: 'Shared files' })).toBeVisible();
  await expect(rail.getByText(evidence.textFileName)).toBeVisible({ timeout: 20000 });
  const previewLink = rail.getByRole('link', { name: `Open ${evidence.textFileName}` });
  const downloadLink = rail.getByRole('link', { name: `Download ${evidence.textFileName}` });
  await expect(previewLink).toHaveAttribute('href', /\/api\/message\/attachments\/.+\/preview$/);
  await expect(downloadLink).toHaveAttribute('href', /\/api\/message\/attachments\/.+\/download$/);
  const previewHref = await previewLink.getAttribute('href');
  const downloadHref = await downloadLink.getAttribute('href');

  expect(previewHref).toBeTruthy();
  expect(downloadHref).toBeTruthy();
  const previewResponse = await page.request.get(previewHref!);
  const downloadResponse = await page.request.get(downloadHref!);

  expect(previewResponse.status(), 'authenticated preview access should succeed').toBeLessThan(400);
  expect(downloadResponse.status(), 'authenticated download access should succeed').toBeLessThan(400);
  await expect(rail.getByRole('heading', { name: 'Shared media' })).toBeVisible();
  await expect(rail.getByText(evidence.imageFileName)).toBeVisible({ timeout: 20000 });

  return `Generated file/media attachments persisted and protected asset access returned preview ${previewResponse.status()} and download ${downloadResponse.status()}.`;
};

const assertNoStaticContentLeaks = async (page: Page, allowlist: readonly string[]) => {
  const visibleText = await page.getByTestId('chat-root').innerText();
  const leaks = findPhase14StaticContentLeaks(visibleText, allowlist);

  expect(leaks, `Static fixture/demo content leaked into live chat: ${leaks.join(', ')}`).toEqual([]);
  return 'Known demo/static strings were absent from the live chat surface.';
};

const verifyDeploymentEvidence = (config: EnabledPhase14Config, observations: readonly string[]) => {
  const backendOrigin = config.metadata.backendOrigin;
  const apiObservations = observations.filter((observation) => observation.includes(': api ') && observation.includes(backendOrigin));
  const socketObservations = observations.filter((observation) => (
    (observation.includes(': socket ') || observation.includes(': websocket ')) &&
    observation.includes(backendOrigin)
  ));
  const cookieObservations = observations.filter((observation) => (
    observation.includes('auth cookie metadata') &&
    !observation.endsWith(' none')
  ));
  const corsOrCredentialErrors = observations.filter((observation) => (
    /console (error|warning).*(cors|access-control|credential|blocked by)/i.test(observation)
  ));

  expect(apiObservations.length, 'API traffic should target the configured deployed backend origin').toBeGreaterThan(0);
  expect(socketObservations.length, 'Socket.IO traffic should target the configured deployed backend origin').toBeGreaterThan(0);
  expect(cookieObservations.length, 'Auth cookie metadata should be recorded for both smoke accounts').toBeGreaterThanOrEqual(2);
  expect(corsOrCredentialErrors, 'No CORS or credential console errors should be observed').toEqual([]);

  return `Observed ${apiObservations.length} API responses, ${socketObservations.length} socket observations, and ${cookieObservations.length} auth cookie metadata rows against ${backendOrigin}.`;
};

const gotoChatVariant = async (
  page: Page,
  config: EnabledPhase14Config,
  chatId: string | null,
  theme: 'light' | 'dark'
) => {
  const target = new URL(config.frontendUrl);
  target.searchParams.set('chatTheme', theme);

  if (chatId) {
    target.searchParams.set('chatId', chatId);
  }

  await page.goto(target.toString(), { waitUntil: 'networkidle' });
  await expect(page.getByTestId('chat-root')).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('textbox', { name: 'Write a private message' })).toBeVisible({ timeout: 30000 });
};

const captureVariantScreenshot = async ({
  chatId,
  config,
  marker,
  page,
  testInfo,
  theme,
  variant,
  viewport,
}: {
  chatId: string | null;
  config: EnabledPhase14Config;
  marker: string;
  page: Page;
  testInfo: TestInfo;
  theme: 'light' | 'dark';
  variant: string;
  viewport: { width: number; height: number };
}) => {
  await page.setViewportSize(viewport);
  await gotoChatVariant(page, config, chatId, theme);
  await expect(markerRows(page, marker)).toHaveCount(1, { timeout: 20000 });
  const screenshotPath = testInfo.outputPath(`${variant}.png`);

  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
};

const writeReport = ({
  blockers,
  checks,
  config,
  evidencePaths,
  observations,
  risks,
  status,
}: {
  blockers: string[];
  checks: Phase14CheckRow[];
  config: Phase14ProductionAcceptanceConfig;
  evidencePaths: string[];
  observations: string[];
  risks: string[];
  status: 'passed' | 'failed' | 'blocked';
}) => {
  writePhase14LiveAcceptanceReport({
    blockers,
    checks: [
      ...checks,
      {
        name: 'Filtered production observations',
        status: observations.length > 0 ? 'passed' : 'skipped',
        detail: observations.length > 0 ? observations.join(' | ') : 'No API or console observations were captured before the gate stopped.',
      },
    ],
    command: phase14RunCommand,
    config,
    evidencePaths,
    risks,
    status,
  });
};

test.describe.serial('Phase 14 production live acceptance', () => {
  test('live messaging, controls, attachments, and static content gate', async ({ browser }, testInfo) => {
    const config = getPhase14ProductionAcceptanceConfig();
    const checks: Phase14CheckRow[] = [];
    const blockers: string[] = [];
    const evidencePaths: string[] = [];
    const observations: string[] = [];
    const risks = [
      'Production readiness remains blocked whenever the live gate is skipped, unavailable, or records any blocker row.',
    ];
    const pages: Phase14Page[] = [];
    const allowlist: string[] = [];

    if (!config.enabled) {
      writeReport({
        blockers: [],
        checks: [
          {
            name: 'Phase 14 production environment contract',
            status: 'blocked',
            detail: config.blockedReason,
          },
        ],
        config,
        evidencePaths,
        observations,
        risks: [
          'No live product readiness claim is allowed until the full Phase 14 gate runs with configured production smoke accounts.',
        ],
        status: 'blocked',
      });
      test.skip(true, config.blockedReason);
      return;
    }

    let sender: Phase14Page | null = null;
    let recipient: Phase14Page | null = null;
    let selectedChatId: string | null = null;
    const messageMarker = makePhase14Marker('message');
    let attachmentEvidence: AttachmentEvidence | null = null;

    allowlist.push(messageMarker);

    try {
      await test.step('authenticate two production smoke accounts', async () => {
        await recordCheck({
          blockers,
          checks,
          name: 'Two-account production authentication',
          run: async () => {
            sender = await createPhase14Page(browser, config, config.accounts.sender, observations);
            pages.push(sender);
            recipient = await createPhase14Page(browser, config, config.accounts.recipient, observations);
            pages.push(recipient);

            return 'Both isolated browser contexts reached the deployed chat shell.';
          },
        });
      });

      await test.step('create or select direct conversation', async () => {
        await recordCheck({
          blockers,
          checks,
          name: 'Direct production conversation selection',
          run: async () => {
            expect(sender).not.toBeNull();
            expect(recipient).not.toBeNull();
            await startOrContinueChat(sender!.page, config.accounts.recipient.email);
            selectedChatId = getSelectedChatId(sender!.page);
            await startOrContinueChat(recipient!.page, config.accounts.sender.email);

            return `Direct chat selected${selectedChatId ? ` (${selectedChatId})` : ''}.`;
          },
        });
      });

      await test.step('send one live marker and verify realtime receive', async () => {
        await recordCheck({
          blockers,
          checks,
          name: 'Exactly-one send with recipient realtime receive',
          run: async () => {
            expect(sender).not.toBeNull();
            expect(recipient).not.toBeNull();
            const sendDetail = await sendTextMarker(sender!.page, messageMarker);
            const receiveDetail = await verifyRecipientRealtimeAndReload(sender!.page, recipient!.page, messageMarker);

            return `${sendDetail} ${receiveDetail}`;
          },
        });
      });

      await test.step('exercise detail surfaces and menus', async () => {
        await recordCheck({
          blockers,
          checks,
          name: 'Desktop detail rail behavior',
          run: async () => {
            expect(sender).not.toBeNull();
            return exerciseDesktopDetails(sender!.page);
          },
        });

        await recordCheck({
          blockers,
          checks,
          name: 'Message search behavior',
          run: async () => {
            expect(sender).not.toBeNull();
            return exerciseMessageSearch(sender!.page, messageMarker);
          },
        });

        await recordCheck({
          blockers,
          checks,
          name: 'More menu behavior',
          run: async () => {
            expect(sender).not.toBeNull();
            return exerciseMoreMenu(sender!.page);
          },
        });

        await recordCheck({
          blockers,
          checks,
          name: 'Mobile detail drawer behavior',
          run: async () => {
            expect(sender).not.toBeNull();
            return exerciseMobileDetails(sender!.page, config, selectedChatId);
          },
        });

        await recordCheck({
          blockers,
          checks,
          name: 'Unsupported control disabled states',
          run: async () => {
            expect(sender).not.toBeNull();
            return exerciseUnsupportedControls(sender!.page);
          },
        });
      });

      await test.step('send generated attachments and verify shared surfaces', async () => {
        await recordCheck({
          blockers,
          checks,
          name: 'Generated attachment send and recipient render',
          run: async () => {
            expect(sender).not.toBeNull();
            expect(recipient).not.toBeNull();
            const attachmentMarker = makePhase14Marker('attachment');
            allowlist.push(attachmentMarker);
            attachmentEvidence = await sendAttachmentMessage(sender!.page, recipient!.page, attachmentMarker);
            allowlist.push(attachmentEvidence.textFileName, attachmentEvidence.imageFileName);

            return 'Generated text and image attachments rendered for sender and recipient.';
          },
        });

        await recordCheck({
          blockers,
          checks,
          name: 'Shared file and media surfaces',
          run: async () => {
            expect(sender).not.toBeNull();
            expect(attachmentEvidence).not.toBeNull();
            return verifySharedSurfaces(sender!.page, config, selectedChatId, attachmentEvidence!);
          },
        });
      });

      await test.step('exercise live audio and video call controls', async () => {
        await recordCheck({
          blockers,
          checks,
          name: 'Live audio call behavior',
          run: async () => {
            expect(sender).not.toBeNull();
            expect(recipient).not.toBeNull();
            return exerciseCallMode({
              caller: sender!.page,
              callee: recipient!.page,
              config,
              mode: 'audio',
              selectedChatId,
            });
          },
        });

        await recordCheck({
          blockers,
          checks,
          name: 'Live video call behavior',
          run: async () => {
            expect(sender).not.toBeNull();
            expect(recipient).not.toBeNull();
            return exerciseCallMode({
              caller: sender!.page,
              callee: recipient!.page,
              config,
              mode: 'video',
              selectedChatId,
            });
          },
        });
      });

      await test.step('exercise block and unblock restore late in the run', async () => {
        await recordCheck({
          blockers,
          checks,
          name: 'Block and unblock restore',
          run: async () => {
            expect(sender).not.toBeNull();
            return exerciseBlockAndRestore(sender!.page);
          },
        });
      });

      await test.step('deny static fixture content and capture behavior-backed screenshots', async () => {
        await recordCheck({
          blockers,
          checks,
          name: 'Static content denylist',
          run: async () => {
            expect(sender).not.toBeNull();
            return assertNoStaticContentLeaks(sender!.page, allowlist);
          },
        });

        await recordCheck({
          blockers,
          checks,
          name: 'Deployment origin, cookie, socket, and console evidence',
          run: async () => verifyDeploymentEvidence(config, observations),
        });

        await recordCheck({
          blockers,
          checks,
          name: 'Post-interaction screenshot matrix',
          run: async () => {
            expect(sender).not.toBeNull();
            const variants = [
              { variant: 'phase14-desktop-light', theme: 'light' as const, viewport: { width: 1440, height: 900 } },
              { variant: 'phase14-desktop-dark', theme: 'dark' as const, viewport: { width: 1440, height: 900 } },
              { variant: 'phase14-mobile-light', theme: 'light' as const, viewport: { width: 390, height: 844 } },
              { variant: 'phase14-mobile-dark', theme: 'dark' as const, viewport: { width: 390, height: 844 } },
            ];

            for (const variant of variants) {
              const screenshotPath = await captureVariantScreenshot({
                chatId: selectedChatId,
                config,
                marker: messageMarker,
                page: sender!.page,
                testInfo,
                ...variant,
              });
              evidencePaths.push(screenshotPath);
            }

            return `Captured ${variants.length} screenshots after live workflow behavior.`;
          },
        });
      });

      writeReport({
        blockers,
        checks,
        config,
        evidencePaths,
        observations,
        risks,
        status: blockers.length === 0 ? 'passed' : 'failed',
      });
      expect(blockers, blockers.join('\n')).toEqual([]);
    } catch (error) {
      if (blockers.length === 0) {
        blockers.push(`Run failed before completion: ${describeBlockedRunError(error)}.`);
      }

      writeReport({
        blockers,
        checks,
        config,
        evidencePaths,
        observations,
        risks,
        status: 'failed',
      });
      throw error;
    } finally {
      if (sender) {
        await restoreUnblockedState(sender.page).catch(() => undefined);
      }

      await Promise.all(pages.map(({ context }) => context.close().catch(() => undefined)));
    }
  });
});
