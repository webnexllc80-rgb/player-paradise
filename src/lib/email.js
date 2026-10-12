import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, html, text }) {
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your_email_password_here') {
    // Development or unconfigured fallback - log gracefully
    console.log(`[Email Simulation] To: ${to} | Subject: ${subject}`);
    return { success: true, simulated: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || 'support@playersparadisehub.com',
      to,
      subject,
      text: text || '',
      html: html || '',
    });

    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.warn('Failed to send email:', err.message);
    return { success: false, error: err.message };
  }
}
