import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// GET: List Redemptions
export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const db = await getDb();
    const redemptionsCol = db.collection('redemptions');

    const isStaff = session.role && session.role !== ROLES.PLAYER;
    const query = {};

    if (!isStaff) {
      query.userId = session.userId;
    }

    if (status && status !== 'all') {
      query.status = status.toUpperCase();
    }

    const items = await redemptionsCol.find(query).sort({ createdAt: -1 }).limit(100).toArray();

    return NextResponse.json({
      success: true,
      redemptions: items.map((r) => ({
        id: r._id ? r._id.toString() : r.id,
        userId: r.userId,
        username: r.username,
        email: r.email,
        amount: r.amount,
        method: r.method,
        destinationTag: r.destinationTag || r.cashtag || '',
        status: r.status || 'PENDING',
        rejectionReason: r.rejectionReason || '',
        payoutRef: r.payoutRef || '',
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Request Redemption / Cashout
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Please log in to cash out.' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, method, destinationTag } = body;

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 25) {
      return NextResponse.json(
        { success: false, error: 'Minimum cashout amount is $25.00 Paradise Cash.' },
        { status: 400 }
      );
    }

    if (!method || !destinationTag) {
      return NextResponse.json(
        { success: false, error: 'Payment method and destination details (e.g. Cashtag, Chime handle, Crypto address) are required.' },
        { status: 400 }
      );
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

    if (!user || (user.balanceSC || 0) < numAmount) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient redeemable balance. You have $${Number(user?.balanceSC || 0).toFixed(2)} SC available.`,
        },
        { status: 400 }
      );
    }

    // Deduct balance immediately
    await usersCol.updateOne(userFilter, {
      $inc: { balanceSC: -numAmount },
    });

    const redemptionsCol = db.collection('redemptions');
    const newRedemption = {
      userId: session.userId,
      username: session.username,
      email: session.email,
      amount: numAmount,
      method,
      destinationTag: destinationTag.trim(),
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await redemptionsCol.insertOne(newRedemption);

    // Record in ledger
    const ledgerCol = db.collection('ledger');
    await ledgerCol.insertOne({
      userId: session.userId,
      username: session.username,
      email: session.email,
      type: 'CASHOUT_REQUEST',
      amountSC: -numAmount,
      amountGC: 0,
      status: 'PENDING',
      notes: `Cashout request of $${numAmount} via ${method} (${destinationTag})`,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Cashout request for $${numAmount.toFixed(2)} submitted successfully! Processed via ${method}.`,
      redemptionId: res.insertedId ? res.insertedId.toString() : '',
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Staff approves (PAID) or rejects (refunds balance)
export async function PATCH(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role === ROLES.PLAYER) {
      return NextResponse.json({ success: false, error: 'Unauthorized staff access.' }, { status: 403 });
    }

    const body = await req.json();
    const { redemptionId, action, rejectionReason, payoutRef } = body;

    if (!redemptionId || !action) {
      return NextResponse.json({ success: false, error: 'Missing redemptionId or action.' }, { status: 400 });
    }

    const db = await getDb();
    const redemptionsCol = db.collection('redemptions');
    const usersCol = db.collection('users');
    const ledgerCol = db.collection('ledger');

    let filter = { _id: redemptionId };
    if (ObjectId.isValid(redemptionId)) {
      filter = { _id: new ObjectId(redemptionId) };
    }

    const record = await redemptionsCol.findOne(filter);
    if (!record) {
      return NextResponse.json({ success: false, error: 'Redemption record not found.' }, { status: 404 });
    }

    if (record.status !== 'PENDING') {
      return NextResponse.json({ success: false, error: 'Redemption has already been processed.' }, { status: 400 });
    }

    if (action === 'APPROVE') {
      await redemptionsCol.updateOne(filter, {
        $set: {
          status: 'PAID',
          payoutRef: payoutRef || 'DISPATCHED_INSTANT',
          processedBy: session.username,
          updatedAt: new Date(),
        },
      });

      // Send notification
      const notifsCol = db.collection('notifications');
      await notifsCol.insertOne({
        userEmail: record.email,
        title: 'Payout Dispatched!',
        message: `Your cashout of $${record.amount} via ${record.method} (${record.destinationTag}) has been paid!`,
        type: 'SUCCESS',
        read: false,
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: `Cashout of $${record.amount} marked as PAID.`,
      });
    } else if (action === 'REJECT') {
      // Refund user balance
      let userFilter = { _id: record.userId };
      if (ObjectId.isValid(record.userId)) {
        userFilter = { _id: new ObjectId(record.userId) };
      }

      await usersCol.updateOne(userFilter, {
        $inc: { balanceSC: record.amount },
      });

      await redemptionsCol.updateOne(filter, {
        $set: {
          status: 'REJECTED',
          rejectionReason: rejectionReason || 'Information could not be verified.',
          processedBy: session.username,
          updatedAt: new Date(),
        },
      });

      await ledgerCol.insertOne({
        userId: record.userId,
        username: record.username,
        email: record.email,
        type: 'CASHOUT_REFUND',
        amountSC: record.amount,
        amountGC: 0,
        status: 'COMPLETED',
        notes: `Refund of rejected cashout ($${record.amount}): ${rejectionReason || 'Staff rejected'}`,
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: `Cashout rejected and $${record.amount} refunded to player's balance.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
