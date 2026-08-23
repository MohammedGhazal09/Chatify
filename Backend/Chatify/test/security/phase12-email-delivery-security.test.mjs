import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const axiosMocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    post: axiosMocks.post,
  },
}));

import { sendNotificationEmail } from '../../Services/emailService.mjs';

const ORIGINAL_ENV = {
  BREVO_API_KEY: process.env.BREVO_API_KEY,
  EMAIL_USER_SENDER: process.env.EMAIL_USER_SENDER,
};

const restoreEnv = (key, value) => {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
};

describe('Phase 12 email delivery security', () => {
  beforeEach(() => {
    axiosMocks.post.mockReset();
    axiosMocks.post.mockResolvedValue({ data: { messageId: 'provider-message-id' } });
    process.env.BREVO_API_KEY = 'phase-12-test-api-key';
    process.env.EMAIL_USER_SENDER = 'chatify-security@example.test';
  });

  afterEach(() => {
    restoreEnv('BREVO_API_KEY', ORIGINAL_ENV.BREVO_API_KEY);
    restoreEnv('EMAIL_USER_SENDER', ORIGINAL_ENV.EMAIL_USER_SENDER);
  });

  it('uses a fixed provider URL with bounded redirects, time, request size, and response size', async () => {
    await expect(sendNotificationEmail({
      email: 'recipient@example.test',
      subject: 'New Chatify message',
      textContent: 'Open Chatify to read it.',
      htmlContent: '<p>Open Chatify to read it.</p>',
    })).resolves.toEqual({ messageId: 'provider-message-id' });

    expect(axiosMocks.post).toHaveBeenCalledTimes(1);
    expect(axiosMocks.post).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          email: 'chatify-security@example.test',
          name: 'Chatify',
        },
        to: [{ email: 'recipient@example.test' }],
        subject: 'New Chatify message',
        htmlContent: '<p>Open Chatify to read it.</p>',
        textContent: 'Open Chatify to read it.',
      },
      expect.objectContaining({
        timeout: 10_000,
        maxRedirects: 0,
        maxBodyLength: 256 * 1024,
        maxContentLength: 256 * 1024,
        responseType: 'json',
        headers: {
          'api-key': 'phase-12-test-api-key',
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
      })
    );
  });

  it('rejects header injection and oversized content before contacting the provider', async () => {
    await expect(sendNotificationEmail({
      email: 'recipient@example.test',
      subject: 'Safe subject\r\nBcc: attacker@example.test',
      textContent: 'Open Chatify.',
      htmlContent: '<p>Open Chatify.</p>',
    })).rejects.toThrow(/subject/i);

    await expect(sendNotificationEmail({
      email: 'recipient@example.test',
      subject: 'New Chatify message',
      textContent: 'Open Chatify.',
      htmlContent: 'x'.repeat((128 * 1024) + 1),
    })).rejects.toThrow(/html/i);

    expect(axiosMocks.post).not.toHaveBeenCalled();
  });

  it('fails closed when provider credentials or sender identity are missing or malformed', async () => {
    delete process.env.BREVO_API_KEY;

    await expect(sendNotificationEmail({
      email: 'recipient@example.test',
      subject: 'New Chatify message',
      textContent: 'Open Chatify.',
      htmlContent: '<p>Open Chatify.</p>',
    })).rejects.toThrow(/configured/i);

    process.env.BREVO_API_KEY = 'phase-12-test-api-key';
    process.env.EMAIL_USER_SENDER = 'sender@example.test\r\nX-Injected: yes';

    await expect(sendNotificationEmail({
      email: 'recipient@example.test',
      subject: 'New Chatify message',
      textContent: 'Open Chatify.',
      htmlContent: '<p>Open Chatify.</p>',
    })).rejects.toThrow(/sender/i);

    expect(axiosMocks.post).not.toHaveBeenCalled();
  });
});
