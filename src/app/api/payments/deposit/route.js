import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { sendEmail } from '@/lib/email';

// GET: List Deposits
export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const db = await getDb();
    const depositsCol = db.collection('deposits');

    const isStaff = session.role && session.role !== ROLES.PLAYER;
    const query = {};

    if (!isStaff) {
      query.userId = session.userId;
    }

    if (status && status !== 'all') {
      query.status = status.toUpperCase();
    }

    const deposits = await depositsCol.find(query).sort({ createdAt: -1 }).limit(100).toArray();

    return NextResponse.json({
      success: true,
      deposits: deposits.map((d) => ({
        id: d._id ? d._id.toString() : d.id,
        userId: d.userId,
        username: d.username,
        email: d.email,
        amount: d.amount,
        method: d.method,
        referenceNumber: d.referenceNumber || d.proofNote || '',
        promoCode: d.promoCode || '',
        status: d.status || 'PENDING',
        creditedAmount: d.creditedAmount || d.amount,
        bonusCredited: d.bonusCredited || 0,
        gcCredited: d.gcCredited || d.amount * 1000,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Player creates deposit submission
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Please log in to submit a deposit.' }, { status: 401 });
    }

    const body = await req.json();
    const { amount, method, referenceNumber, promoCode } = body;

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Please enter a valid deposit amount.' }, { status: 400 });
    }

    if (!method) {
      return NextResponse.json({ success: false, error: 'Please select a deposit payment gateway.' }, { status: 400 });
    }

    const db = await getDb();
    const depositsCol = db.collection('deposits');

    const depositDoc = {
      userId: session.userId,
      username: session.username,
      email: session.email,
      amount: numAmount,
      method,
      referenceNumber: referenceNumber?.trim() || '',
      promoCode: promoCode?.trim() || '',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await depositsCol.insertOne(depositDoc);

    // Create a pending ledger item
    const ledgerCol = db.collection('ledger');
    await ledgerCol.insertOne({
      userId: session.userId,
      username: session.username,
      email: session.email,
      type: 'DEPOSIT_PENDING',
      amountSC: numAmount,
      amountGC: numAmount * 1000,
      status: 'PENDING',
      notes: `Deposit via ${method} (Ref: ${referenceNumber || 'N/A'})`,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: 'Deposit submission received! Our financial team is validating your transaction.',
      depositId: res.insertedId ? res.insertedId.toString() : '',
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Admin / Staff approves or rejects deposit
export async function PATCH(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role === ROLES.PLAYER) {
      return NextResponse.json({ success: false, error: 'Unauthorized staff access.' }, { status: 403 });
    }

    const body = await req.json();
    const { depositId, action, rejectionReason } = body;

    if (!depositId || !action) {
      return NextResponse.json({ success: false, error: 'Missing depositId or action.' }, { status: 400 });
    }

    const db = await getDb();
    const depositsCol = db.collection('deposits');
    const usersCol = db.collection('users');
    const ledgerCol = db.collection('ledger');

    let filter = { _id: depositId };
    if (ObjectId.isValid(depositId)) {
      filter = { _id: new ObjectId(depositId) };
    }

    const deposit = await depositsCol.findOne(filter);
    if (!deposit) {
      return NextResponse.json({ success: false, error: 'Deposit record not found.' }, { status: 404 });
    }

    if (deposit.status === 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Deposit already approved and credited.' }, { status: 400 });
    }

    if (action === 'APPROVE') {
      const depositAmount = parseFloat(deposit.amount);
      const bonusMatch = deposit.promoCode ? depositAmount * 0.2 : 0; // 20% match on promo
      const totalSC = depositAmount + bonusMatch;
      const totalGC = depositAmount * 1000;

      // Update deposit record
      await depositsCol.updateOne(filter, {
        $set: {
          status: 'COMPLETED',
          creditedAmount: totalSC,
          bonusCredited: bonusMatch,
          gcCredited: totalGC,
          approvedBy: session.username,
          updatedAt: new Date(),
        },
      });

      // Credit player balance
      let userFilter = { _id: deposit.userId };
      if (ObjectId.isValid(deposit.userId)) {
        userFilter = { _id: new ObjectId(deposit.userId) };
      }

      await usersCol.updateOne(userFilter, {
        $inc: {
          balanceSC: totalSC,
          balanceGC: totalGC,
        },
      });

      // Insert confirmed ledger
      await ledgerCol.insertOne({
        userId: deposit.userId,
        username: deposit.username,
        email: deposit.email,
        type: 'DEPOSIT_CREDITED',
        amountSC: totalSC,
        amountGC: totalGC,
        status: 'COMPLETED',
        notes: `Deposit of $${depositAmount} approved via ${deposit.method}${bonusMatch > 0 ? ` + $${bonusMatch} Promo Bonus` : ''}`,
        createdAt: new Date(),
      });

      // Send notification
      const notifsCol = db.collection('notifications');
      await notifsCol.insertOne({
        userEmail: deposit.email,
        title: 'Deposit Approved & Credited!',
        message: `Your deposit of $${depositAmount} has been approved! +${totalSC} SC and +${totalGC} GC have been added to your balance.`,
        type: 'SUCCESS',
        read: false,
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: `Deposit of $${depositAmount} approved and balance credited to ${deposit.username}!`,
      });
    } else if (action === 'REJECT') {
      await depositsCol.updateOne(filter, {
        $set: {
          status: 'REJECTED',
          rejectionReason: rejectionReason || 'Transaction could not be confirmed.',
          rejectedBy: session.username,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Deposit rejected.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
