import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import {
  ensurePhase16ProfileImageFixture,
  getPhase16AcceptanceConfig,
  writePhase16AcceptanceReport,
} from './pages/profilePictureAcceptance';

const command = 'cd Frontend/Chatify; npm run test:ui -- --grep "Phase 16"';
const initialConfig = getPhase16AcceptanceConfig();

const assertBackendAvailable = async (request: APIRequestContext, backendUrl: string) => {
  try {
    const response = await request.get(`${backendUrl}/api/csrf-token`, { timeout: 5000 });
    return response.ok();
  } catch {
    return false;
  }
};

const createAuthenticatedPage = async (browser: Browser) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  return { context, page };
};

const signIn = async (page: Page, email: string, password: string) => {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page.getByTestId('chat-root')).toBeVisible({ timeout: 30000 });
};

const startOrContinueChat = async (page: Page, targetEmail: string) => {
  await page.getByRole('button', { name: 'Start new chat' }).click();
  const dialog = page.getByRole('dialog', { name: 'New chat' });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await dialog.getByLabel('Email address').fill(targetEmail);
  await dialog.getByRole('button', { name: 'Start or continue chat' }).click();
  await expect(dialog).toBeHidden({ timeout: 20000 });
};

const openSettings = async (page: Page) => {
  await page.getByRole('button', { name: 'Open settings' }).first().click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
};

test.describe('Phase 16 local profile picture acceptance', () => {
  test('Phase 16 setup writes a blocked artifact when local prerequisites are missing', async () => {
    if (initialConfig.enabled) {
      writePhase16AcceptanceReport({
        command,
        config: initialConfig,
        status: 'passed',
        checks: [
          {
            name: 'Phase 16 local environment contract',
            status: 'passed',
            detail: 'Required local profile-picture acceptance environment is configured.',
          },
        ],
      });
      return;
    }

    writePhase16AcceptanceReport({
      command,
      config: initialConfig,
      status: 'blocked',
      checks: [
        {
          name: 'Phase 16 local environment contract',
          status: 'blocked',
          detail: initialConfig.blockedReason,
        },
      ],
      risks: [
        'Cross-user visibility remains blocked until a local backend and two existing local accounts are configured.',
      ],
    });
    test.skip(true, initialConfig.blockedReason);
  });

  test.describe('enabled local flow', () => {
    test.skip(!initialConfig.enabled, initialConfig.enabled ? 'configured' : initialConfig.blockedReason);

    test('Phase 16 two-account upload is visible through chat identity surfaces', async ({ browser, request }) => {
      if (!initialConfig.enabled) {
        return;
      }

      const backendAvailable = await assertBackendAvailable(request, initialConfig.backendUrl);
      test.skip(!backendAvailable, `Local backend was not reachable at ${initialConfig.backendUrl}.`);

      const imagePath = ensurePhase16ProfileImageFixture();
      const uploader = await createAuthenticatedPage(browser);
      const observer = await createAuthenticatedPage(browser);

      try {
        await signIn(uploader.page, initialConfig.accounts.uploader.email, initialConfig.accounts.uploader.password);
        await startOrContinueChat(uploader.page, initialConfig.accounts.observer.email);
        await openSettings(uploader.page);

        await uploader.page.getByLabel('Choose image').setInputFiles(imagePath);
        await expect(uploader.page.getByAltText(/Selected profile picture preview/)).toBeVisible();
        await uploader.page.getByRole('button', { name: 'Save' }).click();
        await expect(uploader.page.getByRole('status')).toContainText('Profile picture updated.', { timeout: 20000 });
        await expect(uploader.page.getByRole('img', { name: 'Current account profile picture' })).toBeVisible();

        await signIn(observer.page, initialConfig.accounts.observer.email, initialConfig.accounts.observer.password);
        await startOrContinueChat(observer.page, initialConfig.accounts.uploader.email);
        await observer.page.reload({ waitUntil: 'networkidle' });

        await expect(
          observer.page.locator('img[src*="/api/user/"][alt*="profile picture"]').first()
        ).toBeVisible({ timeout: 20000 });

        writePhase16AcceptanceReport({
          command,
          config: initialConfig,
          status: 'passed',
          checks: [
            {
              name: 'Account A profile image upload',
              status: 'passed',
              detail: 'Settings accepted a generated PNG file and returned the updated current-account image.',
            },
            {
              name: 'Account B profile image visibility',
              status: 'passed',
              detail: 'A second authenticated browser context observed an app-served profile image after normal chat refresh.',
            },
          ],
          risks: [
            'This is local acceptance only; production readiness remains governed by production gate phases.',
          ],
        });
      } finally {
        await uploader.context.close();
        await observer.context.close();
      }
    });
  });
});
