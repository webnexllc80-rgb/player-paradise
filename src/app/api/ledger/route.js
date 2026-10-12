import { NextResponse } from 'next/server';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const db = await getDb();
    const ledgerCol = db.collection('ledger');

    const isStaff = session.role && session.role !== ROLES.PLAYER;
    const query = {};

    if (!isStaff) {
      query.userId = session.userId;
    }

    if (type && type !== 'all') {
      query.type = type;
    }

    const records = await ledgerCol.find(query).sort({ createdAt: -1 }).limit(100).toArray();

    return NextResponse.json({
      success: true,
      records: records.map((r) => ({
        id: r._id ? r._id.toString() : r.id,
        userId: r.userId,
        username: r.username,
        email: r.email,
        type: r.type,
        amountSC: r.amountSC || 0,
        amountGC: r.amountGC || 0,
        status: r.status || 'COMPLETED',
        notes: r.notes || '',
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
