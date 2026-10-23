import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';

// GET - Check Freeplay eligibility and claim status
export async function GET(req) {
  try {
    const db = await getDb();
    const settingsDoc = await db.collection('system_settings').findOne({ key: 'general' });
    const configuredAmount = settingsDoc?.freeplayAmountSC !== undefined ? Number(settingsDoc.freeplayAmountSC) : (settingsDoc?.signupBonusSC || 5.0);

    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: true, claimed: false, amount: configuredAmount });
    }

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
      amount: configuredAmount,
      claimedAt: user?.freeplayClaimedAt || null,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST - User requests / claims Freeplay
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Please sign in to claim your Freeplay bonus.' }, { status: 401 });
    }

    const db = await getDb();
    const settingsDoc = await db.collection('system_settings').findOne({ key: 'general' });
    if (settingsDoc?.freeplayActive === false) {
      return NextResponse.json({ success: false, message: 'Freeplay bonus is currently disabled or inactive.' }, { status: 400 });
    }
    const configuredAmount = settingsDoc?.freeplayAmountSC !== undefined ? Number(settingsDoc.freeplayAmountSC) : (settingsDoc?.signupBonusSC || 5.0);

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
        message: 'You have already claimed your Freeplay bonus! Make a deposit to receive up to 300% match bonuses.',
      });
    }

    // Award Freeplay SC configured by Admin
    const awardSC = configuredAmount;
    const newBalanceSC = Number(((Number(user.balanceSC) || 0) + awardSC).toFixed(2));

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
      description: `🎁 $${awardSC.toFixed(2)} Freeplay Bonus claimed from lobby`,
      status: 'completed',
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `🎉 $${awardSC.toFixed(2)} Freeplay bonus credited to your wallet!`,
      newBalanceSC,
      claimed: true,
      amount: awardSC,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
