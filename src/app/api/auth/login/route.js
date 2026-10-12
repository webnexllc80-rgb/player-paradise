import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';
import { signToken } from '@/lib/auth';
import { ensureDbInitialized } from '@/lib/initDb';

export async function POST(req) {
  try {
    await ensureDbInitialized();
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, message: 'Username/Email and password are required.' },
        { status: 400 }
      );
    }

    const cleanId = identifier.trim().toLowerCase();
    const db = await getDb();
    const usersCol = db.collection('users');

    const user = await usersCol.findOne({
      $or: [{ email: cleanId }, { username: cleanId }],
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials. Please verify your login details.' },
        { status: 401 }
      );
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash || '');
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials. Please verify your login details.' },
        { status: 401 }
      );
    }

    if (user.isBanned) {
      return NextResponse.json(
        { success: false, message: 'This account has been suspended. Please contact support.' },
        { status: 403 }
      );
    }

    await usersCol.updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    const userId = user._id.toString();
    const token = signToken({
      userId,
      username: user.username,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Login successful! Welcome back.',
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        role: user.role,
        balanceSC: user.balanceSC || 0,
        balanceGC: user.balanceGC || 0,
        vipTier: user.vipTier || 'Bronze Panda',
        kycStatus: user.kycStatus || 'unverified',
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
    console.error('Login error:', err);
    return NextResponse.json(
      { success: false, message: 'Login error: ' + err.message },
      { status: 500 }
    );
  }
}
