import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

export async function POST() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Please log in to claim your daily bonus.' }, { status: 401 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');

    let userFilter = { _id: session.userId };
    if (ObjectId.isValid(session.userId)) {
      userFilter = { _id: new ObjectId(session.userId) };
    }

    let user = await usersCol.findOne(userFilter);
    if (!user) {
      user = await usersCol.findOne({ email: session.email });
    }

    if (!user) {
      return NextResponse.json({ success: false, message: 'Player account not found.' }, { status: 404 });
    }

    const now = new Date();
    if (user.lastDailyBonusClaim) {
      const lastClaim = new Date(user.lastDailyBonusClaim);
      const hoursSince = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        const remainingHours = Math.ceil(24 - hoursSince);
        return NextResponse.json({
          success: false,
          cooldown: true,
          remainingHours,
          message: `Daily bonus already claimed! Next reward available in ${remainingHours} hours.`,
        });
      }
    }

    // Dynamic mystery reward
    const rewards = [
      { sc: 1.0, gc: 5000, label: 'Cyber Bronze Box' },
      { sc: 2.5, gc: 10000, label: 'Silver Matrix Crate' },
      { sc: 5.0, gc: 25000, label: 'Golden Cyber Chest' },
      { sc: 10.0, gc: 50000, label: 'Diamond Panda Jackpot' },
    ];
    // Weighted pick: 50% bronze, 30% silver, 15% gold, 5% diamond
    const rand = Math.random();
    let picked = rewards[0];
    if (rand > 0.95) picked = rewards[3];
    else if (rand > 0.8) picked = rewards[2];
    else if (rand > 0.5) picked = rewards[1];

    await usersCol.updateOne(userFilter, {
      $inc: { balanceSC: picked.sc, balanceGC: picked.gc },
      $set: { lastDailyBonusClaim: now },
    });

    const ledgerCol = db.collection('ledger');
    await ledgerCol.insertOne({
      userId: session.userId,
      username: session.username,
      email: session.email,
      type: 'DAILY_BONUS',
      amountSC: picked.sc,
      amountGC: picked.gc,
      status: 'COMPLETED',
      notes: `Claimed daily reward: ${picked.label}`,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      message: `Congratulations! You unlocked the ${picked.label}: +${picked.sc} SC and +${picked.gc.toLocaleString()} GC!`,
      reward: picked,
      newBalanceSC: (user.balanceSC || 0) + picked.sc,
      newBalanceGC: (user.balanceGC || 0) + picked.gc,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
