import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

type LocalSmokeAccount = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  provision: boolean;
};

type LocalSmokeConfig =
  | {
    enabled: true;
    backendUrl: string;
    accounts: {
      sender: LocalSmokeAccount;
      recipient: LocalSmokeAccount;
    };
  }
  | {
    enabled: false;
    blockedReason: string;
  };

type CsrfToken = {
  token: string;
  cookieHeader: string;
};

const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const makePassword = () => `Phase101!${Date.now()}Aa`;

const makeGeneratedAccount = (slot: 'a' | 'b'): LocalSmokeAccount => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `phase10-1-${slot}-${runId}@example.test`,
    password: makePassword(),
    firstName: slot === 'a' ? 'Phase' : 'Delivery',
    lastName: slot === 'a' ? 'Sender' : 'Recipient',
    provision: true,
  };
};

const getConfiguredAccount = (slot: 'A' | 'B'): LocalSmokeAccount | null => {
  const email = process.env[`CHATIFY_LOCAL_USER_${slot}_EMAIL`]?.trim();
  const password = process.env[`CHATIFY_LOCAL_USER_${slot}_PASSWORD`]?.trim();

  if (!email || !password) {
    return null;
  }

  return {
    email,
    password,
    firstName: slot === 'A' ? 'Local' : 'Realtime',
    lastName: slot === 'A' ? 'Sender' : 'Recipient',
    provision: false,
  };
};

const parseLocalBackendUrl = (value: string) => {
  try {
    const parsed = new URL(value);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        error: 'CHATIFY_LOCAL_BACKEND_URL must use http or https.',
        hostname: '',
        url: '',
      };
    }

    parsed.hash = '';

    return {
      error: '',
      hostname: parsed.hostname,
      url: parsed.toString().replace(/\/$/, ''),
    };
  } catch {
    return {
      error: 'CHATIFY_LOCAL_BACKEND_URL must be a valid absolute URL.',
      hostname: '',
      url: '',
    };
  }
};

const isLoopbackHost = (hostname: string) => (
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '::1' ||
  hostname === '[::1]' ||
  hostname.endsWith('.localhost')
);

const getLocalSmokeConfig = (): LocalSmokeConfig => {
  if (process.env.CHATIFY_LOCAL_DELIVERY_SMOKE !== '1') {
    return {
      enabled: false,
      blockedReason: 'CHATIFY_LOCAL_DELIVERY_SMOKE=1 is required for the real local delivery smoke.',
    };
  }

  const backendUrlValue = process.env.CHATIFY_LOCAL_BACKEND_URL?.trim() ?? '';
  if (!backendUrlValue) {
    return {
      enabled: false,
      blockedReason: 'CHATIFY_LOCAL_BACKEND_URL is required for local delivery smoke. VITE_BACKEND_URL is intentionally ignored.',
    };
  }

  const parsedBackendUrl = parseLocalBackendUrl(backendUrlValue);
  if (parsedBackendUrl.error) {
    return {
      enabled: false,
      blockedReason: parsedBackendUrl.error,
    };
  }

  const sender = getConfiguredAccount('A');
  const recipient = getConfiguredAccount('B');
  const hasConfiguredAccounts = Boolean(sender && recipient);
  const loopbackBackend = isLoopbackHost(parsedBackendUrl.hostname);
  const allowNonlocalBackend = process.env.CHATIFY_ALLOW_NONLOCAL_DELIVERY_SMOKE === '1';
  const allowGeneratedAccounts = process.env.CHATIFY_LOCAL_EPHEMERAL_BACKEND === '1';

  if (!loopbackBackend && !allowNonlocalBackend) {
    return {
      enabled: false,
      blockedReason: 'CHATIFY_LOCAL_BACKEND_URL must point to localhost, 127.0.0.1, or .localhost unless CHATIFY_ALLOW_NONLOCAL_DELIVERY_SMOKE=1 is set.',
    };
  }

  if (!loopbackBackend && !hasConfiguredAccounts) {
    return {
      enabled: false,
      blockedReason: 'Explicit CHATIFY_LOCAL_USER_A/B_EMAIL and CHATIFY_LOCAL_USER_A/B_PASSWORD are required for nonlocal delivery smoke.',
    };
  }

  if (!hasConfiguredAccounts && !allowGeneratedAccounts) {
    return {
      enabled: false,
      blockedReason: 'Generated local smoke accounts require CHATIFY_LOCAL_EPHEMERAL_BACKEND=1 so persistent databases are not polluted.',
    };
  }

  return {
    enabled: true,
    backendUrl: parsedBackendUrl.url,
    accounts: {
      sender: sender ?? makeGeneratedAccount('a'),
      recipient: recipient ?? makeGeneratedAccount('b'),
    },
  };
};

const assertBackendAvailable = async (request: APIRequestContext, backendUrl: string) => {
  try {
    const response = await request.get(`${backendUrl}/api/csrf-token`, { timeout: 5000 });
    return response.ok();
  } catch {
    return false;
  }
};

const readCsrfTokenFromResponse = (response: Awaited<ReturnType<APIRequestContext['get']>>): CsrfToken | null => {
  const setCookie = response.headers()['set-cookie'] ?? '';
  const csrfCookie = setCookie
    .split(/,(?=\s*[^;=]+=[^;]+)/)
    .map((header) => header.trim())
    .find((header) => header.startsWith(`${CSRF_COOKIE_NAME}=`));

  if (!csrfCookie) {
    return null;
  }

  const [nameValue] = csrfCookie.split(';');
  const separatorIndex = nameValue.indexOf('=');

  if (separatorIndex <= 0) {
    return null;
  }

  const token = decodeURIComponent(nameValue.slice(separatorIndex + 1));

  return {
    token,
    cookieHeader: `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`,
  };
};

const fetchCsrfToken = async (request: APIRequestContext, backendUrl: string) => {
  try {
    const response = await request.get(`${backendUrl}/api/csrf-token`, { timeout: 5000 });

    if (!response.ok()) {
      return null;
    }

    return readCsrfTokenFromResponse(response);
  } catch {
    return null;
  }
};

const readResponseMessage = async (response: Awaited<ReturnType<APIRequestContext['post']>>) => {
  try {
    const body = await response.json();
    return typeof body?.message === 'string' ? body.message : '';
  } catch {
    return '';
  }
};

const provisionAccount = async (
  request: APIRequestContext,
  backendUrl: string,
  account: LocalSmokeAccount,
  csrf: CsrfToken
) => {
  if (!account.provision) {
    return null;
  }

  const response = await request.post(`${backendUrl}/api/auth/signup`, {
    headers: {
      Cookie: csrf.cookieHeader,
      'X-CSRF-Token': csrf.token,
    },
    data: {
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      password: account.password,
    },
  });

  if (response.ok()) {
    return null;
  }

  const message = await readResponseMessage(response);
  if (message.includes('buffering timed out')) {
    return 'Local smoke account provisioning is blocked because MongoDB is not reachable from the local backend.';
  }

  return `Local smoke account provisioning failed with HTTP ${response.status()}.`;
};

const createSmokePage = async (browser: Browser) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  return { context, page };
};

const signIn = async (page: Page, account: LocalSmokeAccount) => {
  await page.goto('/login', { waitUntil: 'networkidle' });
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

test.describe('Phase 10.1 local delivery reliability', () => {
  const initialConfig = getLocalSmokeConfig();

  test('real two-account send is single-copy and no-refresh realtime', async ({ browser, request }) => {
    if (!initialConfig.enabled) {
      test.skip(true, initialConfig.blockedReason);
      return;
    }

    const config = initialConfig;
    const backendAvailable = await assertBackendAvailable(request, config.backendUrl);
    if (!backendAvailable) {
      test.skip(true, `Local backend was not reachable at ${config.backendUrl}.`);
      return;
    }

    const csrf = await fetchCsrfToken(request, config.backendUrl);
    if (!csrf) {
      test.skip(true, `Local backend did not return a usable CSRF token at ${config.backendUrl}.`);
      return;
    }

    const senderProvisionBlocked = await provisionAccount(request, config.backendUrl, config.accounts.sender, csrf);
    if (senderProvisionBlocked) {
      test.skip(true, senderProvisionBlocked);
      return;
    }

    const recipientProvisionBlocked = await provisionAccount(request, config.backendUrl, config.accounts.recipient, csrf);
    if (recipientProvisionBlocked) {
      test.skip(true, recipientProvisionBlocked);
      return;
    }

    const marker = `phase 10.1 local delivery ${new Date().toISOString()}`;
    const sender = await createSmokePage(browser);
    const recipient = await createSmokePage(browser);

    try {
      await signIn(sender.page, config.accounts.sender);
      await startOrContinueChat(sender.page, config.accounts.recipient.email);

      await signIn(recipient.page, config.accounts.recipient);
      await startOrContinueChat(recipient.page, config.accounts.sender.email);

      await sendMarker(sender.page, marker);
      await expect(recipient.page.getByTestId('conversation-pane').getByText(marker).first()).toBeVisible({ timeout: 15000 });
      await expect(markerRows(recipient.page, marker)).toHaveCount(1);

      await sender.page.reload({ waitUntil: 'networkidle' });
      await recipient.page.reload({ waitUntil: 'networkidle' });

      await expect(markerRows(sender.page, marker)).toHaveCount(1, { timeout: 20000 });
      await expect(markerRows(recipient.page, marker)).toHaveCount(1, { timeout: 20000 });
    } finally {
      await sender.context.close();
      await recipient.context.close();
    }
  });
});
