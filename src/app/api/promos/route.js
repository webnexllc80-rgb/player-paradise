import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, getUserFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// GET: Returns empty list (promo code system removed)
export async function GET() {
  return NextResponse.json({
    success: true,
    promotions: [],
  });
}

// POST: Handles Player Daily Streak Bonus Claim only (Promo code system removed)
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please login.' }, { status: 401 });
    }

    const { action } = await req.json();
    const db = await getDb();
    const usersCol = db.collection('users');
    const ledgerCol = db.collection('ledger');

    const user = await usersCol.findOne(getUserFilter(session));
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Daily Bonus Claim
    if (action === 'daily_bonus') {
      const now = new Date();
      const lastDaily = user.lastDailyClaim ? new Date(user.lastDailyClaim) : null;

      if (lastDaily) {
        const diffHours = (now.getTime() - lastDaily.getTime()) / (1000 * 3600);
        if (diffHours < 24) {
          const remainingHours = (24 - diffHours).toFixed(1);
          return NextResponse.json({
            success: false,
            error: `Daily bonus already claimed! Next bonus available in ${remainingHours} hours.`,
          }, { status: 400 });
        }
      }

      // Calculate streak
      const streak = ((user.dailyStreak || 0) % 7) + 1;
      const dailyRewards = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0];
      const rewardSC = dailyRewards[streak - 1];
      const rewardGC = streak * 10000;

      const oldSC = user.balanceSC || 0;
      const newSC = Number((oldSC + rewardSC).toFixed(2));

      await usersCol.updateOne(
        { _id: user._id },
        {
          $inc: { balanceSC: rewardSC, balanceGC: rewardGC },
          $set: { lastDailyClaim: now, dailyStreak: streak },
        }
      );

      await ledgerCol.insertOne({
        userId: user._id.toString(),
        username: user.username,
        type: 'daily_bonus',
        currency: 'SC',
        amount: rewardSC,
        balanceBefore: oldSC,
        balanceAfter: newSC,
        performedBy: 'player',
        notes: `Day ${streak} Daily Streak Reward: +${rewardSC} SC & +${rewardGC} GC`,
        createdAt: now,
      });

      return NextResponse.json({
        success: true,
        message: `Claimed Day ${streak} Bonus! Received ${rewardSC} SC and ${rewardGC} GC.`,
        rewardSC,
        rewardGC,
        streak,
        newBalance: newSC,
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Promo code system has been disabled.',
    }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
