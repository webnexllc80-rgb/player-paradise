import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionUser, getUserFilter } from '@/lib/auth';
import { WHEEL_SLICES } from '@/lib/wheelConstants';

// GET: Check if user is eligible to spin today
export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, authenticated: false, message: 'Please log in to spin.' }, { status: 401 });
    }

    const db = await getDb();
    const user = await db.collection('users').findOne(getUserFilter(session));
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const lastSpin = user.lastDailySpin ? new Date(user.lastDailySpin) : null;
    let canSpin = true;
    let nextSpinAvailableAt = null;

    if (lastSpin) {
      const diffMs = now.getTime() - lastSpin.getTime();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      if (diffMs < twentyFourHoursMs) {
        canSpin = false;
        nextSpinAvailableAt = new Date(lastSpin.getTime() + twentyFourHoursMs);
      }
    }

    return NextResponse.json({
      success: true,
      canSpin,
      slices: WHEEL_SLICES,
      nextSpinAvailableAt,
      lastDailySpin: user.lastDailySpin || null,
      balance: Number(user.balanceSC || 0),
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST: Execute the daily spin
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session || !session.userId) {
      return NextResponse.json({ success: false, message: 'Please log in to spin.' }, { status: 401 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');
    const ledgerCol = db.collection('ledger');

    const user = await usersCol.findOne(getUserFilter(session));
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    const now = new Date();
    const lastSpin = user.lastDailySpin ? new Date(user.lastDailySpin) : null;

    if (lastSpin) {
      const diffMs = now.getTime() - lastSpin.getTime();
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;
      if (diffMs < twentyFourHoursMs) {
        const nextSpin = new Date(lastSpin.getTime() + twentyFourHoursMs);
        return NextResponse.json({
          success: false,
          alreadySpun: true,
          message: 'You have already claimed your free daily spin today!',
          nextSpinAvailableAt: nextSpin,
        }, { status: 400 });
      }
    }

    // STRICT USER REQUIREMENT:
    // "or us ma 2 3 ya 5 py e ruky bs mgr us ma ho 50 tk"
    // Slices show up to $50, but winning amount is strictly restricted to $2, $3, or $5.
    const allowedPrizes = [
      { amount: 2, weight: 55, sliceIndex: 1 }, // $2 slice (index 1)
      { amount: 3, weight: 35, sliceIndex: 2 }, // $3 slice (index 2)
      { amount: 5, weight: 10, sliceIndex: 3 }, // $5 slice (index 3)
    ];

    const rand = Math.random() * 100;
    let selectedPrize = allowedPrizes[0];
    let cumulative = 0;

    for (const p of allowedPrizes) {
      cumulative += p.weight;
      if (rand <= cumulative) {
        selectedPrize = p;
        break;
      }
    }

    const prizeAmount = selectedPrize.amount;
    const sliceIndex = selectedPrize.sliceIndex;

    const oldBalance = Number(user.balanceSC || 0);
    const newBalance = Number((oldBalance + prizeAmount).toFixed(2));

    // Update user balance and record spin timestamp
    await usersCol.updateOne(
      { _id: user._id },
      {
        $inc: { balanceSC: prizeAmount },
        $set: { lastDailySpin: now },
      }
    );

    // Record ledger entry
    await ledgerCol.insertOne({
      userId: user._id.toString(),
      username: user.username,
      type: 'daily_spin_bonus',
      currency: 'USD',
      amount: prizeAmount,
      balanceBefore: oldBalance,
      balanceAfter: newBalance,
      referenceId: `SPIN-${now.getTime()}`,
      notes: `Daily Lucky Spin Wheel Prize of $${prizeAmount.toFixed(2)}`,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      winAmount: prizeAmount,
      sliceIndex,
      slice: WHEEL_SLICES[sliceIndex],
      newBalance,
      message: `Congratulations! You won $${prizeAmount.toFixed(2)} from the Daily Lucky Wheel!`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
