import axios from 'axios';
import { HTMLTemplate } from '../Utils/emailmsg.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

const sendBrevoEmail = async ({ to, subject, htmlContent, textContent }) => {
  const payload = {
    sender: {
      email: process.env.EMAIL_USER_SENDER || 'chatify-help@outlook.com',
      name: 'Chatify'
    },
    to: [{ email: to }],
    subject,
    htmlContent
  };

  if (textContent) {
    payload.textContent = textContent;
  }

  const response = await axios.post(
    'https://api.brevo.com/v3/smtp/email',
    payload,
    {
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      }
    }
  );

  return response.data;
};

export const sendPasswordResetEmail = async (email, resetCode) => {
  
  try {
    const htmlTemplate = HTMLTemplate(resetCode);
    return await sendBrevoEmail({
      to: email,
      subject: 'Chatify Password Reset Code',
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
