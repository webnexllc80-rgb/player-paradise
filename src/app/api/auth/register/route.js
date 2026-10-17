import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';
import { signToken, ROLES } from '@/lib/auth';
import { sendEmail, getWelcomeEmailTemplate } from '@/lib/email';
import { ensureDbInitialized } from '@/lib/initDb';
import { getDeviceIdFromRequest } from '@/lib/deviceServer';

export async function POST(req) {
  try {
    await ensureDbInitialized();

    const body = await req.json();
    const { username, email, password, referralCode: inputRef, state = 'US', ageVerified = true, deviceId: rawDeviceId } = body;

    if (!username || !email || !password) {
      return NextResponse.json({ success: false, error: 'Username, email, and password are required.' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ success: false, error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const deviceId = getDeviceIdFromRequest(req, rawDeviceId);

    const db = await getDb();
    const usersCol = db.collection('users');

    // Check duplicate username or email
    const existing = await usersCol.findOne({
      $or: [
        { email: cleanEmail },
        { username: cleanUsername },
        { email: { $regex: new RegExp(`^${cleanEmail}$`, 'i') } },
        { username: { $regex: new RegExp(`^${cleanUsername}$`, 'i') } },
      ],
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Username or email is already registered. Please log in instead.' },
        { status: 409 }
      );
    }

    // Check referrer if provided
    let referrer = null;
    if (inputRef && typeof inputRef === 'string') {
      referrer = await usersCol.findOne({ referralCode: inputRef.trim().toUpperCase() });
    }

    // Generate unique referral code for this new player
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const myReferralCode = `PP-${randomSuffix}`;

    const passwordHash = await bcrypt.hash(password, 10);
    const initialBonusSC = 5.0; // 5 Free Sweeps Coins ($5.00)
    const initialBonusGC = 50000; // 50,000 Gold Coins

    const sessionVersion = Date.now().toString();

    const newUser = {
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      role: ROLES.PLAYER,
      balanceSC: initialBonusSC,
      balanceGC: initialBonusGC,
      kycStatus: 'none',
      state: (state || 'CA').toUpperCase(),
      country: 'US',
      referralCode: myReferralCode,
      referredBy: referrer ? referrer.username : null,
      deviceId: deviceId,
      boundDevices: [deviceId],
      sessionVersion,
      lastLoginDevice: deviceId,
      lastLoginAt: new Date(),
      affiliateCommissionsEarned: 0,
      affiliateCommissionsUnpaid: 0,
      totalDeposited: 0,
      totalRedeemed: 0,
      isBanned: false,
      createdAt: new Date(),
    };

    const insertRes = await usersCol.insertOne(newUser);
    const userId = insertRes.insertedId ? insertRes.insertedId.toString() : newUser._id;

    // Record welcome bonus into Ledger
    try {
      const ledgerCol = db.collection('ledger');
      await ledgerCol.insertOne({
        userId,
        username: cleanUsername,
        type: 'welcome_bonus',
        currency: 'USD',
        amount: initialBonusSC,
        balanceBefore: 0,
        balanceAfter: initialBonusSC,
        performedBy: 'system',
        notes: 'Sign-up welcome bonus ($5.00 wallet credit)',
        createdAt: new Date(),
      });
    } catch {}

    // Send welcome email in background
    sendEmail({
      to: cleanEmail,
      subject: 'Welcome to Players Paradise - $5.00 Free Bonus Added!',
      html: getWelcomeEmailTemplate(cleanUsername),
    }).catch(() => {});

    // Sign session token with sessionVersion
    const token = signToken({
      userId,
      username: cleanUsername,
      email: cleanEmail,
      role: ROLES.PLAYER,
      sessionVersion,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account registered successfully! Welcome bonus credited.',
      user: {
        userId,
        username: cleanUsername,
        email: cleanEmail,
        role: ROLES.PLAYER,
        balanceSC: initialBonusSC,
        balance: initialBonusSC,
        kycStatus: 'none',
        referralCode: myReferralCode,
      },
    });

    response.cookies.set('vegas_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });
    response.cookies.set('players_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    if (deviceId) {
      response.cookies.set('v1_device_id', deviceId, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 315360000,
      });
    }

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ success: false, error: 'Registration failed: ' + error.message }, { status: 500 });
  }
}
