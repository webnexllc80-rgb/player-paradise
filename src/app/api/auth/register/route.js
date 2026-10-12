import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';
import { signToken, ROLES } from '@/lib/auth';
import { ensureDbInitialized } from '@/lib/initDb';

export async function POST(req) {
  try {
    await ensureDbInitialized();
    const body = await req.json();
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, message: 'Username, email, and password are required.' },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      return NextResponse.json(
        { success: false, message: 'Username must be at least 3 characters.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const usersCol = db.collection('users');

    const existing = await usersCol.findOne({
      $or: [{ email: cleanEmail }, { username: cleanUsername }],
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'Username or email already in use.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const welcomeBonusSC = 5.0; // Free $5.00 Paradise Cash on signup
    const welcomeBonusGC = 10000; // 10,000 Game Coins

    const newUser = {
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      role: ROLES.PLAYER,
      balanceSC: welcomeBonusSC,
      balanceGC: welcomeBonusGC,
      kycStatus: 'unverified',
      vipTier: 'Bronze Panda',
      createdAt: new Date(),
      lastLogin: new Date(),
    };

    const result = await usersCol.insertOne(newUser);
    const userId = result.insertedId.toString();

    // Log welcome bonus in ledger
    const ledgerCol = db.collection('ledger');
    await ledgerCol.insertOne({
      userId,
      username: cleanUsername,
      email: cleanEmail,
      type: 'WELCOME_BONUS',
      amountSC: welcomeBonusSC,
      amountGC: welcomeBonusGC,
      status: 'COMPLETED',
      notes: 'Sign-up welcome bonus package',
      createdAt: new Date(),
    });

    // Create session token
    const token = signToken({
      userId,
      username: cleanUsername,
      email: cleanEmail,
      role: ROLES.PLAYER,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully! Welcome to Players Paradise Hub.',
      user: {
        id: userId,
        username: cleanUsername,
        email: cleanEmail,
        role: ROLES.PLAYER,
        balanceSC: welcomeBonusSC,
        balanceGC: welcomeBonusGC,
        vipTier: 'Bronze Panda',
        kycStatus: 'unverified',
      },
    });

    response.cookies.set('players_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err) {
    console.error('Registration error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error during registration: ' + err.message },
      { status: 500 }
    );
  }
}
