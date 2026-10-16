import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';
import { signToken, ROLES } from '@/lib/auth';
import { ensureDbInitialized } from '@/lib/initDb';
import { getDeviceIdFromRequest } from '@/lib/deviceServer';

export async function POST(req) {
  try {
    await ensureDbInitialized();

    const { identifier, password, deviceId: rawDeviceId } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ success: false, error: 'Identifier and password are required.' }, { status: 400 });
    }

    const cleanId = identifier.trim().toLowerCase();
    const deviceId = getDeviceIdFromRequest(req, rawDeviceId);

    const db = await getDb();
    const usersCol = db.collection('users');

    const user = await usersCol.findOne({
      $or: [{ email: cleanId }, { username: cleanId }],
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid credentials.' }, { status: 401 });
    }

    if (user.isBanned) {
      return NextResponse.json({ success: false, error: 'This account has been suspended.' }, { status: 403 });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ success: false, error: 'Invalid credentials.' }, { status: 401 });
    }

    const isPlayer = !user.role || user.role === ROLES.PLAYER || user.role === 'player' || user.role === 'user';

    // 1. Enforce: Only 1 account per physical device for players
    if (isPlayer) {
      const conflictingUser = await usersCol.findOne({
        _id: { $ne: user._id },
        role: { $in: [ROLES.PLAYER, 'user', 'player', null] },
        $or: [{ deviceId: deviceId }, { boundDevices: deviceId }],
      });

      if (conflictingUser) {
        return NextResponse.json(
          {
            success: false,
            error: `Security Restriction: Only 1 account is permitted per device. This device is already linked to account "${conflictingUser.username}". You cannot log into multiple accounts on the same device.`,
          },
          { status: 403 }
        );
      }
    }

    // 2. Bind device and update active session version
    const sessionVersion = Date.now().toString();
    const userId = user._id.toString();

    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          deviceId: deviceId,
          lastLoginDevice: deviceId,
          sessionVersion,
          lastLoginAt: new Date(),
        },
        $addToSet: { boundDevices: deviceId },
      }
    );

    const token = signToken({
      userId,
      username: user.username,
      email: user.email,
      role: user.role,
      sessionVersion,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      user: {
        userId,
        username: user.username,
        email: user.email,
        role: user.role,
        balanceSC: user.balanceSC || 0,
        balance: user.balanceSC || 0,
        kycStatus: user.kycStatus || 'none',
        referralCode: user.referralCode || '',
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
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed: ' + error.message }, { status: 500 });
  }
}
