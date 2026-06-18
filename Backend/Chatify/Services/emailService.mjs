import axios from 'axios';
import { HTMLTemplate } from '../Utils/emailmsg.mjs';
import { logger } from '../Utils/observabilityLogger.mjs';

export const sendPasswordResetEmail = async (email, resetCode) => {
  
  try {
    const htmlTemplate = HTMLTemplate(resetCode);
    
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          email: process.env.EMAIL_USER_SENDER || 'chatify-help@outlook.com',
          name: 'Chatify'
        },
        to: [{ email }],
        subject: 'Chatify Password Reset Code',
        htmlContent: htmlTemplate
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'accept': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error) {
    logger.error('email.password_reset_delivery_failed', {
      code: error?.code,
      status: error?.response?.status,
      error,
    });
    throw error;
  }
};
