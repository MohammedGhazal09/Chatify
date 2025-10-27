import nodemailer from 'nodemailer'
import {HTMLTemplate} from '../Utils/emailmsg.mjs'
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

export const sendPasswordResetEmail = async (email, resetCode) => {
  const htmlTemplate = HTMLTemplate(resetCode)

  const mailOptions = {
    from: process.env.EMAIL_USER_SENDER,
    to: email,
    subject: 'Chatify Password Reset Code',
    html: htmlTemplate
  }
  return transporter.sendMail(mailOptions)
}