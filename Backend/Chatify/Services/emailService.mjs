import axios from 'axios';
import validator from 'validator';
import { HTMLTemplate } from '../Utils/emailmsg.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const BREVO_EMAIL_URL = 'https://api.brevo.com/v3/smtp/email';
const EMAIL_REQUEST_TIMEOUT_MS = 10_000;
const MAX_EMAIL_REQUEST_BYTES = 256 * 1024;
const MAX_EMAIL_HTML_BYTES = 128 * 1024;
const MAX_EMAIL_TEXT_BYTES = 32 * 1024;
const MAX_EMAIL_SUBJECT_CHARACTERS = 160;
const HEADER_CONTROL_CHARACTERS = /[\r\n\u0000]/;

const createEmailDeliveryError = (message, code) => {
  const error = new Error(message);
  error.name = 'EmailDeliveryError';
  error.code = code;
  return error;
};

const assertEmailAddress = (value, label) => {
  const email = typeof value === 'string' ? value.trim() : '';

  if (
    !email ||
    email.length > 254 ||
    HEADER_CONTROL_CHARACTERS.test(email) ||
    !validator.isEmail(email, { allow_utf8_local_part: false })
  ) {
    throw createEmailDeliveryError(`${label} email is invalid`, 'email_address_invalid');
  }

  return email;
};

const assertEmailSubject = (value) => {
  const subject = typeof value === 'string' ? value.trim() : '';

  if (
    !subject ||
    subject.length > MAX_EMAIL_SUBJECT_CHARACTERS ||
    HEADER_CONTROL_CHARACTERS.test(subject)
  ) {
    throw createEmailDeliveryError('Email subject is invalid', 'email_subject_invalid');
  }

  return subject;
};

const assertEmailContent = ({ htmlContent, textContent }) => {
  if (
    typeof htmlContent !== 'string' ||
    !htmlContent ||
    Buffer.byteLength(htmlContent, 'utf8') > MAX_EMAIL_HTML_BYTES
  ) {
    throw createEmailDeliveryError('Email HTML content is invalid or too large', 'email_html_invalid');
  }

  if (
    textContent !== undefined &&
    (
      typeof textContent !== 'string' ||
      Buffer.byteLength(textContent, 'utf8') > MAX_EMAIL_TEXT_BYTES
    )
  ) {
    throw createEmailDeliveryError('Email text content is invalid or too large', 'email_text_invalid');
  }

  return {
    htmlContent,
    ...(textContent ? { textContent } : {}),
  };
};

const readProviderConfiguration = () => {
  const apiKey = typeof process.env.BREVO_API_KEY === 'string'
    ? process.env.BREVO_API_KEY.trim()
    : '';
  const sender = typeof process.env.EMAIL_USER_SENDER === 'string'
    ? process.env.EMAIL_USER_SENDER.trim()
    : '';

  if (!apiKey || apiKey.length > 512 || HEADER_CONTROL_CHARACTERS.test(apiKey)) {
    throw createEmailDeliveryError(
      'Email delivery provider is not configured',
      'email_provider_not_configured'
    );
  }

  return {
    apiKey,
    sender: assertEmailAddress(sender, 'Sender'),
  };
};

const sendBrevoEmail = async ({ to, subject, htmlContent, textContent }) => {
  const configuration = readProviderConfiguration();
  const recipient = assertEmailAddress(to, 'Recipient');
  const safeSubject = assertEmailSubject(subject);
  const content = assertEmailContent({ htmlContent, textContent });
  const payload = {
    sender: {
      email: configuration.sender,
      name: 'Chatify',
    },
    to: [{ email: recipient }],
    subject: safeSubject,
    htmlContent: content.htmlContent,
  };

  if (content.textContent) {
    payload.textContent = content.textContent;
  }

  const response = await axios.post(
    BREVO_EMAIL_URL,
    payload,
    {
      timeout: EMAIL_REQUEST_TIMEOUT_MS,
      maxRedirects: 0,
      maxBodyLength: MAX_EMAIL_REQUEST_BYTES,
      maxContentLength: MAX_EMAIL_REQUEST_BYTES,
      responseType: 'json',
      headers: {
        'api-key': configuration.apiKey,
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
    }
  );

  return response.data;
};

export const sendPasswordResetEmail = async (email, resetCode) => {
  try {
    const htmlTemplate = HTMLTemplate(resetCode);
    return await sendBrevoEmail({
      to: email,
      subject: 'Reset your Chatify password',
      htmlContent: htmlTemplate,
    });
  } catch (error) {
    logger.error('email.password_reset_delivery_failed', {
      code: error?.code,
      status: error?.response?.status,
      error,
    });
    throw error;
  }
};

export const sendNotificationEmail = async ({ email, subject, textContent, htmlContent }) => {
  try {
    return await sendBrevoEmail({
      to: email,
      subject,
      textContent,
      htmlContent,
    });
  } catch (error) {
    logger.error('email.notification_delivery_failed', {
      code: error?.code,
      status: error?.response?.status,
      error,
    });
    throw error;
  }
};
