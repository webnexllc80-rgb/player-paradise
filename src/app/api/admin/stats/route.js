import { NextResponse } from 'next/server';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { ensureDbInitialized } from '@/lib/initDb';

export async function GET() {
  try {
    await ensureDbInitialized();
    const session = await getSessionUser();
    if (!session || session.role === ROLES.PLAYER) {
      return NextResponse.json({ success: false, error: 'Unauthorized staff access.' }, { status: 403 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');
    const depositsCol = db.collection('deposits');
    const redemptionsCol = db.collection('redemptions');
    const requestsCol = db.collection('accountRequests');

    const totalUsers = await usersCol.countDocuments({});
    const pendingDepositsCount = await depositsCol.countDocuments({ status: 'PENDING' });
    const pendingWithdrawalsCount = await redemptionsCol.countDocuments({ status: 'PENDING' });
    const pendingGameRequestsCount = await requestsCol.countDocuments({ status: 'PENDING' });

    const allDeposits = await depositsCol.find({ status: 'COMPLETED' }).toArray();
    const totalDeposited = allDeposits.reduce((acc, d) => acc + (parseFloat(d.amount) || 0), 0);

    const allRedemptions = await redemptionsCol.find({ status: 'PAID' }).toArray();
    const totalWithdrawn = allRedemptions.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        totalDeposited: Math.round(totalDeposited * 100) / 100,
        totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
        netRevenue: Math.round((totalDeposited - totalWithdrawn) * 100) / 100,
        pendingDeposits: pendingDepositsCount,
        pendingWithdrawals: pendingWithdrawalsCount,
        pendingGameRequests: pendingGameRequestsCount,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
