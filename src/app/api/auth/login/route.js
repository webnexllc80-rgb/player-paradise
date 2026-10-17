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

    // Case-insensitive lookup for email or username
    const user = await usersCol.findOne({
      $or: [
        { email: cleanId },
        { username: cleanId },
        { email: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
        { username: { $regex: new RegExp(`^${cleanId}$`, 'i') } },
      ],
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid credentials. User not found.' }, { status: 401 });
    }

    if (user.isBanned) {
      return NextResponse.json({ success: false, error: 'This account has been suspended.' }, { status: 403 });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json({ success: false, error: 'Invalid password. Please check your credentials.' }, { status: 401 });
    }

    const isStaff =
      user.role === ROLES.SUPER_ADMIN ||
      user.role === ROLES.FINANCIAL_MANAGER ||
      user.role === ROLES.COIN_MANAGER ||
      user.role === ROLES.CHAT_SUPPORT ||
      user.role === ROLES.OPERATION_ADMIN;

    // Track active device and session version
    const sessionVersion = Date.now().toString();
    const userId = user._id ? user._id.toString() : user.id;

    if (deviceId) {
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
    }

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
      isAdmin: isStaff,
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
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed: ' + error.message }, { status: 500 });
  }
}
