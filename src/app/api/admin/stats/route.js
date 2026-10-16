import { NextResponse } from 'next/server';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const session = await getSessionUser();
    const authorizedRoles = [
      ROLES.SUPER_ADMIN,
      ROLES.OPERATION_ADMIN,
      ROLES.FINANCIAL_MANAGER,
      ROLES.COIN_MANAGER,
      ROLES.CHAT_SUPPORT,
    ];
    if (!session || !authorizedRoles.includes(session.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized staff access.' }, { status: 403 });
    }

    const db = await getDb();

    // 1. Players count
    const totalPlayers = await db.collection('users').countDocuments({ role: ROLES.PLAYER });

    // 2. Pending deposits and redemptions
    const pendingDeposits = await db.collection('deposits').countDocuments({ status: 'pending' });
    const pendingRedemptions = await db.collection('redemptions').countDocuments({ status: 'pending' });
    const pendingKyc = await db.collection('kyc_requests').countDocuments({ status: 'pending' });

    // 3. Deposit & Redemption financial aggregates
    const depositStats = await db.collection('deposits').aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).toArray();

    const redemptionStats = await db.collection('redemptions').aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).toArray();

    const totalDeposited = depositStats[0]?.total || 0;
    const totalRedeemed = redemptionStats[0]?.total || 0;
    const netGGR = Number((totalDeposited - totalRedeemed).toFixed(2));

    // 4. Game Activity volume
    const activityStats = await db.collection('game_activity').aggregate([
      {
        $group: {
          _id: null,
          totalBets: { $sum: '$betAmount' },
          totalWins: { $sum: '$winAmount' },
          totalRounds: { $sum: 1 },
        },
      },
    ]).toArray();

    const totalWagers = activityStats[0]?.totalBets || 0;
    const totalPayouts = activityStats[0]?.totalWins || 0;
    const totalRounds = activityStats[0]?.totalRounds || 0;

    return NextResponse.json({
      success: true,
      stats: {
        totalPlayers,
        totalDeposited,
        totalRedeemed,
        netGGR,
        pendingDeposits,
        pendingRedemptions,
        pendingKyc,
        totalWagers,
        totalPayouts,
        totalRounds,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
