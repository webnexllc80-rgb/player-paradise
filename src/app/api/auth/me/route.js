import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const db = await getDb();
    const usersCol = db.collection('users');
    const user = await usersCol.findOne({ _id: new ObjectId(session.userId) });

    if (!user) {
      const resp = NextResponse.json({ authenticated: false, user: null });
      resp.cookies.delete('vegas_session');
      resp.cookies.delete('players_session');
      return resp;
    }

    if (user.isBanned) {
      const resp = NextResponse.json({ authenticated: false, user: null, error: 'Account suspended.' });
      resp.cookies.delete('vegas_session');
      resp.cookies.delete('players_session');
      return resp;
    }

    // 1. Single Active Session Check (If logged in elsewhere, expire older session)
    if (session.sessionVersion && user.sessionVersion && session.sessionVersion !== user.sessionVersion) {
      const resp = NextResponse.json({
        authenticated: false,
        user: null,
        sessionExpired: true,
        error: 'Your account was logged in from another device. Session terminated.',
      });
      resp.cookies.delete('vegas_session');
      resp.cookies.delete('players_session');
      return resp;
    }

    // 2. Single Account Per Device Verification
    const isPlayer = !user.role || user.role === ROLES.PLAYER || user.role === 'player' || user.role === 'user';
    if (isPlayer) {
      const cookieStore = await cookies();
      const clientDeviceId = cookieStore.get('v1_device_id')?.value;

      if (clientDeviceId && clientDeviceId.length >= 6) {
        const otherOwner = await usersCol.findOne({
          _id: { $ne: user._id },
          role: { $in: [ROLES.PLAYER, 'user', 'player', null] },
          $or: [{ deviceId: clientDeviceId }, { boundDevices: clientDeviceId }],
        });

        if (otherOwner) {
          const resp = NextResponse.json({
            authenticated: false,
            user: null,
            deviceConflict: true,
            error: `Device Policy: Only 1 account is permitted per device. This device is bound to account "${otherOwner.username}".`,
          });
          resp.cookies.delete('vegas_session');
      resp.cookies.delete('players_session');
          return resp;
        }
      }
    }

    const frozenBalance = Math.max(0, Number((user.frozenBalance || 0).toFixed(2)));
    const balanceSC = Number((user.balanceSC || 0).toFixed(2));
    const availableSC = Math.max(0, Number((balanceSC - frozenBalance).toFixed(2)));

    return NextResponse.json({
      authenticated: true,
      user: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        balanceSC,
        balanceGC: Number(user.balanceGC || 0),
        frozenBalance,
        availableSC,
        balance: balanceSC,
        kycStatus: user.kycStatus || 'none',
        referralCode: user.referralCode || '',
        referredBy: user.referredBy || null,
        totalDeposited: user.totalDeposited || 0,
        welcomeBonusClaimed: Boolean(user.welcomeBonusClaimed || (user.totalDeposited && user.totalDeposited > 0)),
        affiliateCommissionsUnpaid: user.affiliateCommissionsUnpaid || 0,
        affiliateCommissionsEarned: user.affiliateCommissionsEarned || 0,
        deviceId: user.deviceId || null,
      },
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false, error: error.message }, { status: 500 });
  }
}
