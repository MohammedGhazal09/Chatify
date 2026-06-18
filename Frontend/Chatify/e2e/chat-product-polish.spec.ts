import { expect, test, type Page } from '@playwright/test';
import {
  PHASE19_PRIMARY_CHAT_ID,
  phase19ProductPolishFixture,
} from './fixtures/phase19ProductPolishFixture';
import {
  expectNoHorizontalOverflow,
  openPhase19Chat,
  phase19ArtifactPath,
} from './pages/chatPage';

const installNotificationMock = async (page: Page, permission: NotificationPermission = 'default') => {
  await page.addInitScript((initialPermission) => {
    let currentPermission = initialPermission as NotificationPermission;
    const createdNotifications: Array<{ title: string; body?: string }> = [];

    class Phase19Notification {
      static get permission() {
        return currentPermission;
      }

      static async requestPermission() {
        currentPermission = 'granted';
        return currentPermission;
      }

      title: string;
      body?: string;

      constructor(title: string, options?: NotificationOptions) {
        this.title = title;
        this.body = options?.body;
        createdNotifications.push({ title, body: options?.body });
      }
    }

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: Phase19Notification,
    });
    Object.defineProperty(window, '__phase19Notifications', {
      configurable: true,
      value: createdNotifications,
    });
  }, permission);
};

test.describe('Phase 19 product polish verification', () => {
  test('Phase 19 notification settings and mute controls stay generic and recoverable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installNotificationMock(page);
    await openPhase19Chat(page, { theme: 'light' });

    const safeCopy = await page.evaluate(async () => {
      const { getSafeNotificationCopy } = await import('/src/utils/notificationPrivacy.ts');
      return getSafeNotificationCopy({ eventType: 'message' });
    });
    expect(safeCopy).toEqual({
      title: 'New Chatify message',
      body: 'Open Chatify to read it.',
    });

    await page.getByRole('button', { name: 'Open settings' }).first().click();
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByText('Alerts use generic copy. Muted conversations still update unread counts and receipts.')).toBeVisible();
    await expect(page.getByText('Permission: Ask first')).toBeVisible();
    await page.getByRole('button', { name: 'Enable' }).click();
    await expect(page.getByText('Permission: Allowed')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'More conversation actions' }).first().click();
    await page.getByRole('menu', { name: 'Conversation actions' }).getByRole('menuitem', { name: 'Mute conversation' }).click();

    await expect(page.getByLabel('Conversation muted')).toBeVisible();
    await expect(page.getByText('New Chatify message')).not.toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('Phase 19 auth-expired privacy hides private conversation content', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installNotificationMock(page, 'granted');
    await openPhase19Chat(page, { theme: 'dark' });

    await expect(page.getByTestId('conversation-pane').getByText('Product polish checkpoint is visible.')).toBeVisible();
    await page.evaluate(() => {
      window.dispatchEvent(new Event('chatify:auth-expired'));
    });

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Product polish checkpoint is visible.')).not.toBeVisible();
  });

  test('Phase 19 mobile empty no-results and offline states fit without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installNotificationMock(page, 'denied');
    await openPhase19Chat(page, {
      theme: 'dark',
      apiOptions: {
        messagesByChatId: {
          [PHASE19_PRIMARY_CHAT_ID]: [],
        },
      },
    });

    await expect(page.getByRole('heading', { name: phase19ProductPolishFixture.selectedTitle })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No messages yet' })).toBeVisible();
    await expect(page.getByText('Send the first message or attach a file when you are ready.')).toBeVisible();

    await page.getByRole('button', { name: 'Open conversations' }).click();
    await page.getByRole('textbox', { name: 'Search conversations' }).fill('missing-route');
    await expect(page.getByText('No matching conversations')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear conversation search' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear conversation search' }).click();
    await expect(page.getByRole('button', { name: /Signal Desk/ })).toBeVisible();

    await page.context().setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await expect(page.getByRole('status').filter({ hasText: 'You are offline. New messages will wait until the connection returns.' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: phase19ArtifactPath('19-mobile-edge-states.png') });
    await page.context().setOffline(false);
  });
});
