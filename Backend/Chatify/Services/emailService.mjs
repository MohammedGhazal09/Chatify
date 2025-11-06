import axios from 'axios';
import { HTMLTemplate } from '../Utils/emailmsg.mjs';

// Debug: Log environment variables
console.log('=== EMAIL SERVICE DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('BREVO_API_KEY exists:', !!process.env.BREVO_API_KEY);
console.log('BREVO_API_KEY starts with:', process.env.BREVO_API_KEY?.substring(0, 15) + '***');
console.log('EMAIL_USER_SENDER:', process.env.EMAIL_USER_SENDER);
console.log('===========================');

export const sendPasswordResetEmail = async (email, resetCode) => {
  console.log('📧 Attempting to send password reset email via Brevo API...');
  console.log('📧 Recipient:', email);
  console.log('📧 Reset code:', resetCode);
  
  try {
    const htmlTemplate = HTMLTemplate(resetCode);

    console.log('📧 Sending request to Brevo API...');
    
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
    
    console.log('✅ Email sent successfully via Brevo API!');
    console.log('✅ Message ID:', response.data.messageId);
    console.log('✅ Response:', response.data);
    
    return response.data;
  } catch (error) {
    console.error('❌ Email sending failed!');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error response:', error.response?.data);
    console.error('❌ Status code:', error.response?.status);
    throw error;
  }
};