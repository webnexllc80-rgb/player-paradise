import nodemailer from 'nodemailer';

function createSmtpTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'false' ? false : port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER || 'verified@playersparadisehub.com',
      pass: process.env.SMTP_PASS || '',
    },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

export async function sendEmail({ to, subject, html, text }) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.log(`[SMTP SIMULATED - No credentials] To: ${to} | Subject: ${subject}`);
    return { success: true, simulated: true };
  }

  try {
    const transporter = createSmtpTransporter();
    const fromAddress = process.env.SMTP_FROM || user || 'verified@playersparadisehub.com';

    const info = await transporter.sendMail({
      from: `"Players Paradise" <${fromAddress}>`,
      to,
      subject,
      text: text || '',
      html,
    });

    console.log(`[SMTP SUCCESS] Sent to: ${to} | ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SMTP ERROR] To: ${to} | Message: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export function getWelcomeEmailTemplate(username) {
  return `
    <div style="background-color: #070514; color: #ffffff; padding: 40px; font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; border-radius: 16px; border: 1px solid rgba(0, 240, 255, 0.35); text-align: center;">
      <img src="https://playersparadisehub.com/logo.png" alt="Players Paradise" style="height: 60px; margin-bottom: 12px;" />
      <h1 style="color: #00F0FF; margin: 0 0 8px 0; font-size: 24px; font-weight: 900; letter-spacing: 1px;">PLAYERS PARADISE</h1>
      <p style="color: #E026D8; font-size: 13px; margin-top: 0; letter-spacing: 2px; text-transform: uppercase;">PREMIUM CYBER GAMING &amp; SWEEPS</p>
      <hr style="border-color: rgba(0, 240, 255, 0.15); margin: 24px 0;" />
      <h2 style="font-size: 20px; color: #FFFFFF; text-align: left;">Welcome to the VIP High Rollers, ${username}!</h2>
      <p style="font-size: 15px; color: #cbd5e1; line-height: 1.6; text-align: left;">
        Your Players Paradise account is ready. You have received your <strong>Welcome Sweep Coins &amp; Gold Coins</strong>.
      </p>
      <div style="background-color: #0E0A24; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid rgba(0, 240, 255, 0.3); text-align: left;">
        <p style="margin: 0; font-size: 17px; color: #00F0FF; font-weight: bold;">Exclusive 300% Welcome Pack</p>
        <p style="margin: 8px 0 0 0; font-size: 13px; color: #e2e8f0;">Deposit today to unlock instant free SC for real cash redemptions.</p>
      </div>
      <a href="https://playersparadisehub.com" style="display: inline-block; background: linear-gradient(135deg, #00F0FF 0%, #E026D8 100%); color: #070514; padding: 14px 32px; font-weight: 900; text-decoration: none; border-radius: 9999px; font-size: 15px; letter-spacing: 0.05em;">
        PLAY NOW &amp; WIN
      </a>
      <p style="margin-top: 36px; font-size: 11px; color: #64748b;">
        No purchase necessary. Void where prohibited. Must be 18+ and a US resident.
      </p>
    </div>
  `;
}

export function getOtpEmailTemplate(otp, purpose = 'Account Verification') {
  return `
    <div style="background-color: #070514; color: #FFFFFF; padding: 40px 24px; font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 520px; margin: auto; border-radius: 16px; border: 1px solid rgba(0, 240, 255, 0.35); box-shadow: 0 20px 50px rgba(0,0,0,0.85); text-align: center;">
      <div style="margin-bottom: 24px;">
        <img src="https://playersparadisehub.com/logo.png" alt="Players Paradise" style="height: 56px; margin-bottom: 8px;" />
        <h1 style="color: #00F0FF; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 1px;">PLAYERS PARADISE</h1>
        <p style="color: #E026D8; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 2px;">Premium Cyber Gaming &amp; Sweeps</p>
      </div>
      <div style="background: #0E0A24; border: 1px solid rgba(0, 240, 255, 0.18); border-radius: 12px; padding: 24px; text-align: center;">
        <h2 style="font-size: 17px; margin: 0 0 10px 0; color: #FFFFFF;">${purpose} Code</h2>
        <p style="font-size: 13px; color: #9A91A8; margin: 0 0 22px 0; line-height: 1.5;">
          Use the 6-digit one-time security code below to complete your action. This code will expire in <strong>10 minutes</strong>.
        </p>
        <div style="display: inline-block; background: linear-gradient(135deg, rgba(0, 240, 255, 0.15), rgba(224, 38, 216, 0.15)); border: 2px dashed #00F0FF; padding: 14px 28px; border-radius: 12px; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #00F0FF; font-family: monospace;">
          ${otp}
        </div>
      </div>
      <p style="margin-top: 24px; font-size: 11px; color: #64748B; text-align: center; line-height: 1.5;">
        If you did not request this security code, please ignore this email or reach out to 24/7 VIP Live Support.
      </p>
    </div>
  `;
}
