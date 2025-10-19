import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

export const sendPasswordResetEmail = async (email, resetCode) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Chatify Password Reset Code',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #22c55e;">Password Reset Request</h2>
        <p>You requested to reset your password. Please use the following code:</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h1 style="text-align: center; color: #111827; letter-spacing: 8px; margin: 0;">${resetCode}</h1>
        </div>
        <p style="color: #6b7280;">This code will expire in 5 minutes.</p>
        <p style="color: #6b7280;">If you didn't request this, please ignore this email.</p>
      </div>
    `
  }
  return transporter.sendMail(mailOptions)
}