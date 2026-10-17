import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendEmail, getOtpEmailTemplate } from '@/lib/email';
import { ensureDbInitialized } from '@/lib/initDb';

export async function POST(req) {
  try {
    await ensureDbInitialized();
    const body = await req.json();
    const { action = 'send', email, code, purpose = 'Verification' } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ success: false, error: 'Email address is required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = await getDb();
    const otpsCol = db.collection('otps');

    // 1. Action: SEND OTP
    if (action === 'send') {
      // Generate 6-digit numeric OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store in DB (upsert for this email & purpose)
      await otpsCol.updateOne(
        { email: cleanEmail, purpose },
        {
          $set: {
            email: cleanEmail,
            code: otpCode,
            purpose,
            expiresAt,
            attempts: 0,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      // Send email via Hostinger SMTP
      const sendResult = await sendEmail({
        to: cleanEmail,
        subject: `Your Players Paradise ${purpose} Security Code: ${otpCode}`,
        html: getOtpEmailTemplate(otpCode, purpose),
      });

      if (!sendResult.success && !sendResult.simulated) {
        return NextResponse.json(
          { success: false, error: 'Failed to dispatch email: ' + (sendResult.error || 'SMTP delivery issue') },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `A 6-digit security code has been sent to ${cleanEmail}.`,
      });
    }

    // 2. Action: VERIFY OTP
    if (action === 'verify') {
      if (!code || typeof code !== 'string') {
        return NextResponse.json({ success: false, error: 'Security code is required.' }, { status: 400 });
      }

      const cleanCode = code.trim();
      const record = await otpsCol.findOne({ email: cleanEmail, purpose });

      if (!record) {
        return NextResponse.json({ success: false, error: 'No verification code found. Please request a new code.' }, { status: 404 });
      }

      if (new Date() > new Date(record.expiresAt)) {
        await otpsCol.deleteOne({ _id: record._id });
        return NextResponse.json({ success: false, error: 'Verification code has expired. Please request a new one.' }, { status: 400 });
      }

      if (record.code !== cleanCode) {
        await otpsCol.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
        return NextResponse.json({ success: false, error: 'Invalid verification code. Please check and try again.' }, { status: 400 });
      }

      // Valid OTP -> remove record
      await otpsCol.deleteOne({ _id: record._id });

      return NextResponse.json({
        success: true,
        verified: true,
        message: 'Email successfully verified.',
      });
    }

    return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    console.error('OTP handler error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
