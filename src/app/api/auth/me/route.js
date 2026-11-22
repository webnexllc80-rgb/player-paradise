import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES, attachSessionCookies, isStaffRole } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { cache } from '@/lib/cache';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const referer = req.headers.get('referer') || '';
    const isAdminQuery = searchParams.get('admin') === 'true' || referer.includes('/admin');

    const cookieStore = await cookies();
    const hadAdminCookie = Boolean(cookieStore.get('admin_session')?.value);
    const hadPlayerCookie = Boolean(
      cookieStore.get('players_session')?.value || cookieStore.get('vegas_session')?.value
    );

    const session = await getSessionUser(isAdminQuery ? 'admin' : 'player');
    if (!session || !session.userId) {
      const sessionExpired = isAdminQuery ? hadAdminCookie : hadPlayerCookie;
      const resp = NextResponse.json({ authenticated: false, user: null, sessionExpired });
      if (isAdminQuery && hadAdminCookie) {
        resp.cookies.delete('admin_session');
      }
      if (!isAdminQuery && hadPlayerCookie) {
        resp.cookies.delete('vegas_session');
        resp.cookies.delete('players_session');
      }
      return resp;
    }

    const cacheKey = `auth_me_${session.userId}`;
    const cached = cache.get(cacheKey);

    const db = await getDb();
    const usersCol = db.collection('users');

    let user = null;
    try {
      if (ObjectId.isValid(session.userId) && String(session.userId).length === 24) {
        user = await usersCol.findOne({ _id: new ObjectId(session.userId) });
      }
    } catch {}

    if (!user) {
      user = await usersCol.findOne({
        $or: [
          { _id: session.userId },
          { username: session.username },
          { email: session.email },
        ],
      });
    }

    if (user && user.isBanned) {
      const resp = NextResponse.json({ authenticated: false, user: null, error: 'Account suspended.', sessionExpired: true });
      resp.cookies.delete('vegas_session');
      resp.cookies.delete('players_session');
      resp.cookies.delete('admin_session');
      return resp;
    }

    const userData = cached || (() => {
      const balanceSC = user ? Number((user.balanceSC || 0).toFixed(2)) : 0;
      const frozenBalance = user ? Math.max(0, Number((user.frozenBalance || 0).toFixed(2))) : 0;
      const availableSC = Math.max(0, Number((balanceSC - frozenBalance).toFixed(2)));

      return {
        userId: user?._id ? user._id.toString() : session.userId,
        username: user?.username || session.username,
        email: user?.email || session.email,
        role: user?.role || session.role || ROLES.PLAYER,
        balanceSC,
        balanceGC: user ? Number(user.balanceGC || 0) : 50000,
        frozenBalance,
        availableSC,
        balance: balanceSC,
        kycStatus: user?.kycStatus || 'none',
        referralCode: user?.referralCode || '',
        referredBy: user?.referredBy || null,
        totalDeposited: user?.totalDeposited || 0,
        welcomeBonusClaimed: Boolean(user?.welcomeBonusClaimed || (user?.totalDeposited && user.totalDeposited > 0)),
        affiliateCommissionsUnpaid: user?.affiliateCommissionsUnpaid || 0,
        affiliateCommissionsEarned: user?.affiliateCommissionsEarned || 0,
      };
    })();

    if (!cached) {
      cache.set(cacheKey, userData, 3);
    }

    const response = NextResponse.json({
      authenticated: true,
      user: userData,
    });

    const scope = isAdminQuery && isStaffRole(session.role) ? 'admin' : 'player';
    attachSessionCookies(response, session, { scope });

    return response;
  } catch (error) {
    console.error('Error in /api/auth/me:', error);
    return NextResponse.json({ authenticated: false, error: error.message }, { status: 500 });
  }
}