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

    // Run all counts & aggregations concurrently in parallel for 0.1s response
    const [
      totalPlayers,
      pendingDeposits,
      pendingRedemptions,
      pendingKyc,
      depositStats,
      redemptionStats,
      activityStats,
    ] = await Promise.all([
      db.collection('users').countDocuments({ role: ROLES.PLAYER }),
      db.collection('deposits').countDocuments({ status: 'pending' }),
      db.collection('redemptions').countDocuments({ status: 'pending' }),
      db.collection('kyc_requests').countDocuments({ status: 'pending' }),
      db.collection('deposits').aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('redemptions').aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).toArray(),
      db.collection('game_activity').aggregate([
        {
          $group: {
            _id: null,
            totalBets: { $sum: '$betAmount' },
            totalWins: { $sum: '$winAmount' },
            totalRounds: { $sum: 1 },
          },
        },
      ]).toArray(),
    ]);

    const totalDeposited = depositStats[0]?.total || 0;
    const totalRedeemed = redemptionStats[0]?.total || 0;
    const netGGR = Number((totalDeposited - totalRedeemed).toFixed(2));

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
