import nodemailer from 'nodemailer'
import {HTMLTemplate} from '../Utils/emailmsg.mjs'

// Debug: Log environment variables (without exposing full credentials)
console.log('=== EMAIL SERVICE DEBUG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER exists:', !!process.env.EMAIL_USER);
console.log('EMAIL_USER value:', process.env.EMAIL_USER?.substring(0, 5) + '***');
console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
console.log('EMAIL_PASS length:', process.env.EMAIL_PASS?.length);
console.log('EMAIL_USER_SENDER:', process.env.EMAIL_USER_SENDER);
console.log('===========================');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

// Verify transporter configuration
transporter.verify(function (error, success) {
  if (error) {
    console.error('❌ Transporter verification failed:', error);
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

export const sendPasswordResetEmail = async (email, resetCode) => {
  console.log('📧 Attempting to send password reset email...');
  console.log('📧 Recipient:', email);
  console.log('📧 Reset code:', resetCode);
  
  try {
    const htmlTemplate = HTMLTemplate(resetCode)

    const mailOptions = {
      from: process.env.EMAIL_USER_SENDER,
      to: email,
      subject: 'Chatify Password Reset Code',
      html: htmlTemplate
    }
    
    console.log('📧 Mail options configured:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      htmlLength: htmlTemplate.length
    });

    console.log('📧 Sending email via transporter...');
    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ Email sent successfully!');
    console.log('✅ Message ID:', result.messageId);
    console.log('✅ Response:', result.response);
    
    return result;
  } catch (error) {
    console.error('❌ Email sending failed!');
    console.error('❌ Error name:', error.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error command:', error.command);
    console.error('❌ Full error:', JSON.stringify(error, null, 2));
    throw error;
  }
}