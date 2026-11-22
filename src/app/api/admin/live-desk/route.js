import { NextResponse } from 'next/server';
import { getAdminSessionUser, isStaffRole, attachSessionCookies } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { fetchAdminLiveDeskSnapshot } from '@/lib/adminLiveDesk';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const session = await getAdminSessionUser();
    if (!session || !isStaffRole(session.role)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const db = await getDb();
    const payload = await fetchAdminLiveDeskSnapshot(db);

    const response = NextResponse.json(payload);
    attachSessionCookies(response, session, { scope: 'admin' });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (err) {
    console.error('live-desk error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}