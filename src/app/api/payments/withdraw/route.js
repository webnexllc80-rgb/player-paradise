import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES, getUserFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { sendEmail } from '@/lib/email';

// GET: List Redemptions
export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const stage = searchParams.get('stage');

    const db = await getDb();
    const redemptionsCol = db.collection('redemptions');

    const isStaff =
      session.role === ROLES.SUPER_ADMIN ||
      session.role === ROLES.FINANCIAL_MANAGER ||
      session.role === ROLES.OPERATION_ADMIN ||
      session.role === ROLES.COIN_MANAGER;
    const query = {};

    if (!isStaff) {
      query.userId = session.userId;
    }

    if (status && status !== 'all') {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    }

    if (stage && stage !== 'all') {
      query.stage = stage;
    }

    const items = await redemptionsCol.find(query).sort({ createdAt: -1 }).limit(100).toArray();

    return NextResponse.json({
      success: true,
      redemptions: items.map(r => ({
        id: r._id.toString(),
        userId: r.userId,
        username: r.username,
        amount: r.amount,
        gameTitle: r.gameTitle || 'Standard Platform',
        gameScreenshot: r.gameScreenshot || null,
        qrCodeImage: r.qrCodeImage || null,
        payoutMethod: r.payoutMethod,
        destinationAddress: r.destinationAddress,
        status: r.status,
        stage: r.stage || (r.status === 'pending_coin' ? 'coin_verification' : 'finance_payout'),
        processedBy: r.processedBy || null,
        coinApprovedBy: r.coinApprovedBy || null,
        coinApprovedAt: r.coinApprovedAt || null,
        rejectReason: r.rejectReason || r.coinRejectReason || r.financeRejectReason || null,
        coinRejectReason: r.coinRejectReason || null,
        financeRejectReason: r.financeRejectReason || null,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Player Request Redemption
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Please login.' }, { status: 401 });
    }

    const body = await req.json();
    const {
      amount,
      payoutMethod,
      destinationAddress,
      gameTitle,
      gameScreenshot,
      qrCodeImage,
      resubmitFrom,
      resubmitOfId,
    } = body;

    const redeemAmount = Number(amount);
    if (!redeemAmount || redeemAmount < 20.0) {
      return NextResponse.json({ success: false, error: 'Minimum redemption is 20.00 SC ($20.00).' }, { status: 400 });
    }

    if (!destinationAddress || !payoutMethod) {
      return NextResponse.json({ success: false, error: 'Payout method and destination address are required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');
    const redemptionsCol = db.collection('redemptions');
    const ledgerCol = db.collection('ledger');

    const user = await usersCol.findOne(getUserFilter(session));
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }


    const currentSC = Number(user.balanceSC || 0);
    const currentFrozen = Math.max(0, Number(user.frozenBalance || 0));
    const availableSC = Math.max(0, Number((currentSC - currentFrozen).toFixed(2)));

    if (availableSC < redeemAmount) {
      return NextResponse.json({
        success: false,
        error: `Insufficient available balance. You have $${availableSC.toFixed(2)} available ($${currentFrozen.toFixed(2)} is currently frozen in processing).`,
      }, { status: 400 });
    }

    // 1. Freeze funds in player account so they cannot be spent or transferred
    await usersCol.updateOne(
      { _id: user._id },
      {
        $inc: { frozenBalance: redeemAmount },
      }
    );

    // Initial stage: If resubmitted from finance rejection, go directly to finance, else start at coin verification
    const initialStatus = resubmitFrom === 'finance' ? 'pending' : 'pending_coin';
    const initialStage = resubmitFrom === 'finance' ? 'finance_payout' : 'coin_verification';

    // 2. Create Redemption Record
    const insertRes = await redemptionsCol.insertOne({
      userId: user._id.toString(),
      username: user.username,
      amount: redeemAmount,
      gameTitle: gameTitle || 'Standard Platform',
      gameScreenshot: gameScreenshot || null,
      qrCodeImage: qrCodeImage || null,
      payoutMethod,
      destinationAddress,
      status: initialStatus,
      stage: initialStage,
      processedBy: null,
      coinApprovedBy: null,
      coinApprovedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2b. If resubmitted from an earlier rejected request, mark previous as superseded
    if (resubmitOfId) {
      try {
        await redemptionsCol.updateOne(
          { _id: new ObjectId(resubmitOfId), userId: user._id.toString() },
          {
            $set: {
              status: 'resubmitted',
              resubmittedAt: new Date(),
              newRedemptionId: insertRes.insertedId.toString(),
            },
          }
        );
      } catch (err) {
        console.warn('Could not update old redemption to resubmitted:', err);
      }
    }

    // 3. Write Immutable Ledger Entry
    await ledgerCol.insertOne({
      userId: user._id.toString(),
      username: user.username,
      type: 'redemption_escrow',
      currency: 'SC',
      amount: redeemAmount,
      balanceBefore: currentSC,
      balanceAfter: currentSC,
      frozenAmount: redeemAmount,
      performedBy: 'player',
      referenceId: insertRes.insertedId.toString(),
      notes: `Cashout request ($${redeemAmount} SC) submitted for ${gameTitle || 'Platform'} via ${payoutMethod} to ${destinationAddress} ($${redeemAmount} frozen in escrow)`,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Cashout requested successfully! $${redeemAmount.toFixed(2)} is held in escrow. Verified payouts are dispatched directly to your account.`,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: Approve or Reject Redemption (Coin Desk & Finance Desk)
export async function PUT(req) {
  try {
    const session = await getSessionUser();
    const authorizedRoles = [
      ROLES.SUPER_ADMIN,
      ROLES.FINANCIAL_MANAGER,
      ROLES.OPERATION_ADMIN,
      ROLES.COIN_MANAGER,
    ];
    if (!session || !authorizedRoles.includes(session.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized staff action.' }, { status: 403 });
    }

    const { redemptionId, action, rejectReason } = await req.json();

    if (!redemptionId || !action) {
      return NextResponse.json({ success: false, error: 'Redemption ID and action required.' }, { status: 400 });
    }

    const db = await getDb();
    const redemptionsCol = db.collection('redemptions');
    const usersCol = db.collection('users');
    const ledgerCol = db.collection('ledger');

    const redemption = await redemptionsCol.findOne({ _id: new ObjectId(redemptionId) });
    if (!redemption) {
      return NextResponse.json({ success: false, error: 'Redemption not found.' }, { status: 404 });
    }

    const user = await usersCol.findOne({ _id: new ObjectId(redemption.userId) });

    // ACTION 1: COIN DESK APPROVAL (Verify game score & forward to Finance / Ledger)
    if (action === 'coin_approve') {
      await redemptionsCol.updateOne(
        { _id: redemption._id },
        {
          $set: {
            status: 'pending',
            stage: 'finance_payout',
            coinApprovedBy: `${session.username} (${session.role})`,
            coinApprovedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      await ledgerCol.insertOne({
        userId: redemption.userId,
        username: redemption.username,
        type: 'coin_verification_passed',
        currency: 'SC',
        amount: redemption.amount,
        balanceBefore: user ? user.balanceSC : 0,
        balanceAfter: user ? user.balanceSC : 0,
        performedBy: session.username,
        staffRole: session.role,
        referenceId: redemptionId,
        notes: `Game score screenshot verified for ${redemption.gameTitle || 'platform'}. Forwarded to Finance Ledger for payout.`,
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: 'Game score verified! Cashout passed to Finance Ledger for payout.',
      });
    }

    // ACTION 2: COIN DESK REJECTION (Invalid screenshot, wrong score, etc.)
    if (action === 'coin_reject') {
      const reason = rejectReason || 'Game winning screenshot could not be verified or score mismatch.';

      // Unfreeze player's balance
      await usersCol.updateOne(
        { _id: new ObjectId(redemption.userId) },
        { $inc: { frozenBalance: -redemption.amount } }
      );

      await redemptionsCol.updateOne(
        { _id: redemption._id },
        {
          $set: {
            status: 'rejected_by_coin',
            stage: 'rejected_coin',
            rejectReason: reason,
            coinRejectReason: reason,
            processedBy: `${session.username} (${session.role})`,
            updatedAt: new Date(),
          },
        }
      );

      const currentSC = user ? user.balanceSC || 0 : 0;
      await ledgerCol.insertOne({
        userId: redemption.userId,
        username: redemption.username,
        type: 'redemption_rejected_by_coin',
        currency: 'SC',
        amount: redemption.amount,
        balanceBefore: currentSC,
        balanceAfter: currentSC,
        performedBy: session.username,
        staffRole: session.role,
        referenceId: redemptionId,
        notes: `Coin Manager rejected cashout ($${redemption.amount} SC unfrozen): ${reason}`,
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: 'Cashout rejected by Coin Desk. Reason saved and balance unfrozen for player.',
      });
    }

    // ACTION 3: FINANCE DESK APPROVE / DISPATCH (Payment sent via Cash App QR / Address)
    if (action === 'approve' || action === 'finance_dispatch') {
      if (redemption.status === 'approved') {
        return NextResponse.json({ success: false, error: 'Redemption is already approved.' }, { status: 400 });
      }

      const oldSC = user ? user.balanceSC || 0 : 0;
      const newSC = Number((oldSC - redemption.amount).toFixed(2));

      await redemptionsCol.updateOne(
        { _id: redemption._id },
        {
          $set: {
            status: 'approved',
            stage: 'completed',
            processedBy: `${session.username} (${session.role})`,
            updatedAt: new Date(),
          },
        }
      );

      // Permanently deduct balance and clear frozen amount
      await usersCol.updateOne(
        { _id: new ObjectId(redemption.userId) },
        {
          $inc: {
            balanceSC: -redemption.amount,
            frozenBalance: -redemption.amount,
            totalRedeemed: redemption.amount,
          },
        }
      );

      // Record final deduction in ledger
      await ledgerCol.insertOne({
        userId: redemption.userId,
        username: redemption.username,
        type: 'redemption',
        currency: 'SC',
        amount: -redemption.amount,
        balanceBefore: oldSC,
        balanceAfter: newSC,
        performedBy: session.username,
        staffRole: session.role,
        referenceId: redemptionId,
        notes: `Cashout approved & dispatched via ${redemption.payoutMethod} to ${redemption.destinationAddress}`,
        createdAt: new Date(),
      });

      // Email notification
      if (user?.email) {
        sendEmail({
          to: user.email,
          subject: 'Players Paradise Cashout Dispatched!',
          html: `<p>Your prize redemption of $${redemption.amount} via ${redemption.payoutMethod} has been sent!</p>`,
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, message: 'Cashout dispatched! Balance deducted and funds sent to user.' });
    }

    // ACTION 4: FINANCE DESK REJECT (Address invalid, QR scan error, etc.)
    if (action === 'reject' || action === 'finance_reject') {
      const reason = rejectReason || 'Finance desk payment dispatch failed or invalid recipient details.';

      // Unfreeze player's balance so it is available again
      await usersCol.updateOne(
        { _id: new ObjectId(redemption.userId) },
        { $inc: { frozenBalance: -redemption.amount } }
      );

      await redemptionsCol.updateOne(
        { _id: redemption._id },
        {
          $set: {
            status: 'rejected_by_finance',
            stage: 'rejected_finance',
            rejectReason: reason,
            financeRejectReason: reason,
            processedBy: `${session.username} (${session.role})`,
            updatedAt: new Date(),
          },
        }
      );

      // Log unfreeze in ledger
      const currentSC = user ? user.balanceSC || 0 : 0;
      await ledgerCol.insertOne({
        userId: redemption.userId,
        username: redemption.username,
        type: 'redemption_rejected_by_finance',
        currency: 'SC',
        amount: redemption.amount,
        balanceBefore: currentSC,
        balanceAfter: currentSC,
        performedBy: session.username,
        staffRole: session.role,
        referenceId: redemptionId,
        notes: `Finance desk rejected payout ($${redemption.amount} unfrozen & returned): ${reason}`,
        createdAt: new Date(),
      });

      return NextResponse.json({ success: true, message: 'Payout rejected by Finance. Funds unfrozen and note saved.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
