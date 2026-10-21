import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDb } from '@/lib/mongodb';
import { signToken, ROLES } from '@/lib/auth';
import { ensureDbInitialized } from '@/lib/initDb';
import { getDeviceIdFromRequest } from '@/lib/deviceServer';

export async function POST(req) {
  try {
    await ensureDbInitialized();

    const body = await req.json();
    const { identifier, password, deviceId: rawDeviceId, isAdminLogin } = body;
    const referer = req.headers.get('referer') || '';
    const isExplicitAdminPortal = Boolean(isAdminLogin || referer.includes('/admin'));

    if (!identifier || !password) {
      return NextResponse.json({ success: false, error: 'Identifier and password are required.' }, { status: 400 });
    }

    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanPassword = typeof password === 'string' ? password.trim() : password;
    const deviceId = getDeviceIdFromRequest(req, rawDeviceId);

    const db = await getDb();
    const usersCol = db.collection('users');

    // Case-insensitive lookup for email or username
    let user = await usersCol.findOne({
      $or: [
        { email: cleanId },
        { username: cleanId },
        { email: { $regex: new RegExp(`^${cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        { username: { $regex: new RegExp(`^${cleanId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      ],
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Invalid credentials. User not found.' }, { status: 401 });
    }

    if (user.isBanned) {
      return NextResponse.json({ success: false, error: 'This account has been suspended.' }, { status: 403 });
    }

    let passwordMatch = await bcrypt.compare(cleanPassword, user.passwordHash);
    if (!passwordMatch && password !== cleanPassword) {
      passwordMatch = await bcrypt.compare(password, user.passwordHash);
    }

    if (!passwordMatch) {
      return NextResponse.json({ success: false, error: 'Invalid password. Please check your credentials.' }, { status: 401 });
    }

    const isStaff =
      user.role === ROLES.SUPER_ADMIN ||
      user.role === ROLES.ADMIN ||
      user.role === ROLES.FINANCIAL_MANAGER ||
      user.role === ROLES.COIN_MANAGER ||
      user.role === ROLES.CHAT_SUPPORT ||
      user.role === ROLES.OPERATION_ADMIN;

    // Strict security: Super Admin & Staff credentials are for the Admin Portal only
    if (isStaff && !isExplicitAdminPortal) {
      return NextResponse.json(
        {
          success: false,
          error: 'Administrator & Staff credentials cannot be used for player gaming. Please log in at the Admin Portal (/admin).',
          isAdminOnly: true,
        },
        { status: 403 }
      );
    }

    // Strict security: Regular players cannot log into the Admin Portal
    if (isExplicitAdminPortal && !isStaff) {
      return NextResponse.json(
        {
          success: false,
          error: 'Access denied: This portal is strictly restricted to authorized staff & administrators.',
        },
        { status: 403 }
      );
    }

    // Hardware / Device binding restriction: 1 device = 1 account
    if (!isStaff && !isExplicitAdminPortal && deviceId) {
      const boundUser = await usersCol.findOne({
        _id: { $ne: user._id },
        role: ROLES.PLAYER,
        $or: [
          { deviceId: deviceId },
          { boundDevices: deviceId },
          { lastLoginDevice: deviceId },
        ],
      });

      if (boundUser) {
        return NextResponse.json(
          {
            success: false,
            error: `Device Binding Restriction: Yeh device doosre account (${boundUser.email}) ke sath bind hai. Iss device par sirf ${boundUser.email} login ho sakti hai. (This device is bound to ${boundUser.email})`,
          },
          { status: 403 }
        );
      }
    }

    // Track active device and session version
    const sessionVersion = Date.now().toString();
    const userId = user._id ? user._id.toString() : user.id;

    const updateFields = {
      sessionVersion,
      lastLoginAt: new Date(),
    };
    if (deviceId) {
      updateFields.deviceId = deviceId;
      updateFields.lastLoginDevice = deviceId;
    }

    const updateOps = { $set: updateFields };
    if (deviceId) {
      updateOps.$addToSet = { boundDevices: deviceId };
    }
    await usersCol.updateOne({ _id: user._id }, updateOps);

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
        balanceGC: user.balanceGC || 0,
        balance: user.balanceSC || 0,
        kycStatus: user.kycStatus || 'none',
        referralCode: user.referralCode || '',
      },
    });

    if (isStaff || isExplicitAdminPortal) {
      // Independent cookie for admin portal: does NOT overwrite player session
      response.cookies.set('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      });
    } else {
      // Independent cookie for player: does NOT overwrite admin session
      response.cookies.set('players_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      });
      response.cookies.set('vegas_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      });
    }

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
