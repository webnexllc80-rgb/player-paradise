import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUser, getUserFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { ensureDbInitialized } from '@/lib/initDb';

export async function POST(req) {
  try {
    await ensureDbInitialized();
    const body = await req.json();
    const { action, email, otp, newPassword, oldPassword } = body;

    // 1. Password Reset via Email OTP (Forgot Password Flow)
    if (action === 'reset' || (email && otp && newPassword)) {
      if (!email || !otp || !newPassword) {
        return NextResponse.json(
          { success: false, error: 'Email, verification code (OTP), and new password are required.' },
          { status: 400 }
        );
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanOtp = String(otp).trim();
      const cleanPassword = typeof newPassword === 'string' ? newPassword.trim() : '';

      if (cleanPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'New password must be at least 6 characters long.' },
          { status: 400 }
        );
      }

      const db = await getDb();
      const otpsCol = db.collection('otps');
      const usersCol = db.collection('users');

      // Verify OTP in DB
      const otpRecord = await otpsCol.findOne({ email: cleanEmail });
      if (!otpRecord) {
        return NextResponse.json(
          { success: false, error: 'No verification code found for this email. Please request a new code.' },
          { status: 400 }
        );
      }

      if (new Date() > new Date(otpRecord.expiresAt)) {
        await otpsCol.deleteOne({ _id: otpRecord._id });
        return NextResponse.json(
          { success: false, error: 'Verification code has expired. Please request a new code.' },
          { status: 400 }
        );
      }

      if (otpRecord.code !== cleanOtp) {
        await otpsCol.updateOne({ _id: otpRecord._id }, { $inc: { attempts: 1 } });
        return NextResponse.json(
          { success: false, error: 'Invalid verification code. Please check your email and try again.' },
          { status: 400 }
        );
      }

      // OTP verified! Delete record to prevent replay
      await otpsCol.deleteOne({ _id: otpRecord._id });

      // Lookup user
      const safeEmail = cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const user = await usersCol.findOne({
        $or: [
          { email: cleanEmail },
          { email: { $regex: new RegExp(`^${safeEmail}$`, 'i') } },
        ],
      });

      if (!user) {
        return NextResponse.json({ success: false, error: 'User account not found.' }, { status: 404 });
      }

      // Hash new password and invalidate previous sessions
      const newHash = await bcrypt.hash(cleanPassword, 10);
      const newSessionVersion = Date.now().toString();

      await usersCol.updateOne(
        { _id: user._id },
        {
          $set: {
            passwordHash: newHash,
            sessionVersion: newSessionVersion,
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully! You can now log in with your new password.',
      });
    }

    // 2. Change Password while authenticated
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please log in.' }, { status: 401 });
    }

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Both current and new passwords are required.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCol = db.collection('users');

    const user = await usersCol.findOne(getUserFilter(session));
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ success: false, error: 'Incorrect current password.' }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await usersCol.updateOne(
      { _id: user._id },
      { $set: { passwordHash: newHash, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, message: 'Password updated successfully!' });
  } catch (error) {
    console.error('Password route error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
