import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';

// GET - Check 3 Freeplay eligibility and claim status
export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: true, claimed: false, amount: 3.0 });
    }

    const db = await getDb();
    const userId = session.userId || session.id;
    let user = null;
    if (userId && ObjectId.isValid(userId)) {
      user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    }
    if (!user && session.email) {
      user = await db.collection('users').findOne({ email: session.email.toLowerCase().trim() });
    }

    const claimed = Boolean(user?.freeplayClaimed);

    return NextResponse.json({
      success: true,
      claimed,
      amount: 3.0,
      claimedAt: user?.freeplayClaimedAt || null,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST - User requests / claims 3 Freeplay
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Please sign in to claim your 3 Freeplay.' }, { status: 401 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');
    const userId = session.userId || session.id;
    let user = null;
    if (userId && ObjectId.isValid(userId)) {
      user = await usersCol.findOne({ _id: new ObjectId(userId) });
    }
    if (!user && session.email) {
      user = await usersCol.findOne({ email: session.email.toLowerCase().trim() });
    }

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found. Please log in again.' }, { status: 404 });
    }

    if (user.freeplayClaimed) {
      return NextResponse.json({
        success: false,
        alreadyClaimed: true,
        message: 'Already claimed! You have already claimed your 3 Freeplay bonus.',
      });
    }

    // Award 3 SC Freeplay
    const awardSC = 3.0;
    const newBalanceSC = (Number(user.balanceSC) || 0) + awardSC;

    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          freeplayClaimed: true,
          freeplayClaimedAt: new Date(),
          balanceSC: newBalanceSC,
        },
      }
    );

    // Record in ledger
    const ledgerCol = db.collection('ledger');
    await ledgerCol.insertOne({
      userId: user._id.toString(),
      userEmail: user.email,
      username: user.username,
      type: 'freeplay_bonus',
      amount: awardSC,
      currency: 'SC',
      balanceAfter: newBalanceSC,
      description: '🎁 3 Freeplay Welcome Bonus credited to vault',
      status: 'completed',
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: '🎉 $3.00 Freeplay bonus credited to your vault!',
      newBalanceSC,
      claimed: true,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
