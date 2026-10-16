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

    const { username, email, password, referralCode: inputRef, state = 'US', ageVerified, deviceId: rawDeviceId } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ success: false, error: 'All fields are required.' }, { status: 400 });
    }

    if (!ageVerified) {
      return NextResponse.json(
        { success: false, error: 'You must confirm that you are at least 18 years old (21+ where applicable).' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const deviceId = getDeviceIdFromRequest(req, rawDeviceId);

    const db = await getDb();
    const usersCol = db.collection('users');

    // Check duplicate username or email
    const existing = await usersCol.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Username or email is already registered.' },
        { status: 409 }
      );
    }

    // 2. Device Restriction Check (Only 1 account per device)
    const deviceOwner = await usersCol.findOne({
      $or: [{ deviceId: deviceId }, { boundDevices: deviceId }],
    });

    if (deviceOwner) {
      return NextResponse.json(
        {
          success: false,
          error: `Security Restriction: Only 1 account is permitted per device. This device is already linked to account "${deviceOwner.username}". Multiple accounts are not allowed.`,
        },
        { status: 403 }
      );
    }

    // Check referrer if provided
    let referrer = null;
    if (inputRef) {
      referrer = await usersCol.findOne({ referralCode: inputRef.trim().toUpperCase() });
    }

    // Generate unique referral code for this new player
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const myReferralCode = `V1-${randomSuffix}`;

    const passwordHash = await bcrypt.hash(password, 10);
    const initialBonusSC = 5.0; // 5 Free Sweeps Coins
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
    const userId = insertRes.insertedId.toString();

    // Record welcome bonus into Ledger
    const ledgerCol = db.collection('ledger');
    await ledgerCol.insertOne({
      userId,
      username: cleanUsername,
      type: 'welcome_bonus',
      currency: 'SC',
      amount: initialBonusSC,
      balanceBefore: 0,
      balanceAfter: initialBonusSC,
      performedBy: 'system',
      notes: 'New account signup welcome bonus (5 SC + 50,000 GC)',
      createdAt: new Date(),
    });

    // Send welcome email in background
    sendEmail({
      to: cleanEmail,
      subject: 'Welcome to Vegas One - 5 Free SC Added to Your Wallet!',
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
      message: 'Account registered successfully!',
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

    // Persist 10-year device ID cookie
    response.cookies.set('v1_device_id', deviceId, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 315360000,
    });

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ success: false, error: 'Registration failed: ' + error.message }, { status: 500 });
  }
}
