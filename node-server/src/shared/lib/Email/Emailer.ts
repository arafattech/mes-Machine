import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.GMAIL_PASS_KEY,
  },
});

export async function Emailer(
  to: string,
  subject: string,
  text: string,
  html?: string
) {
  try {
    if (!process.env.EMAIL_USER || !process.env.GOOGLE_API_KEY) {
      throw new Error('Email credentials not configured');
    }

    const info = await transporter.sendMail({
      from: `"Hybritech" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text
    });

    console.log(' Email sent:', info.messageId);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Email failed:', error.message);
      if (error.stack) console.error(error.stack);
    }
    return false;
  }
}