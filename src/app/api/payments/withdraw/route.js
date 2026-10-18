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
        destinationTag: r.destinationTag || r.destinationAddress || '',
        destinationAddress: r.destinationAddress || r.destinationTag || '',
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
      destinationTag,
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

    const finalTag = (destinationTag || destinationAddress || '').trim();
    if (!finalTag) {
      return NextResponse.json({ success: false, error: 'Your Payout Tag Name / Cashtag is required.' }, { status: 400 });
    }

    if (!payoutMethod) {
      return NextResponse.json({ success: false, error: 'Payout method is required.' }, { status: 400 });
    }

    if (!gameScreenshot) {
      return NextResponse.json({ success: false, error: 'Game winning screenshot is required to verify your winnings.' }, { status: 400 });
    }

    if (!qrCodeImage) {
      return NextResponse.json({ success: false, error: 'Your Payout QR Code screenshot is required.' }, { status: 400 });
    }

    const db = await getDb();
    const usersCol = db.collection('users');
    const redemptionsCol = db.collection('redemptions');
    const ledgerCol = db.collection('ledger');

    const user = await usersCol.findOne(getUserFilter(session));
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // Per rules: Withdrawal winnings are verified from the external game, no wallet balance deduction/freeze
    const initialStatus = 'pending';
    const initialStage = 'finance_payout';

    // Create Redemption Record
    const insertRes = await redemptionsCol.insertOne({
      userId: user._id.toString(),
      username: user.username,
      amount: redeemAmount,
      gameTitle: gameTitle || 'Game Platform',
      gameScreenshot: gameScreenshot || null,
      qrCodeImage: qrCodeImage || null,
      destinationTag: finalTag,
      destinationAddress: (destinationAddress || finalTag).trim(),
      payoutMethod,
      status: initialStatus,
      stage: initialStage,
      processedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Write Ledger Entry for Cashout Audit Trail
    await ledgerCol.insertOne({
      userId: user._id.toString(),
      username: user.username,
      type: 'redemption_request',
      currency: 'SC',
      amount: redeemAmount,
      balanceBefore: user.balanceSC || 0,
      balanceAfter: user.balanceSC || 0,
      performedBy: 'player',
      referenceId: insertRes.insertedId.toString(),
      notes: `Cashout requested: $${redeemAmount} SC for ${gameTitle || 'Game'} via ${payoutMethod} to tag ${finalTag} (Game proof & payout QR attached)`,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Cashout request for $${redeemAmount.toFixed(2)} submitted! Desk agents will verify your game screenshot & QR tag to dispatch your payout.`,
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

    const safeFilter = (targetId) => {
      if (!targetId) return { _id: null };
      const is24Hex = typeof targetId === 'string' && targetId.length === 24 && /^[0-9a-fA-F]{24}$/.test(targetId);
      if (is24Hex && ObjectId.isValid(targetId)) {
        return { $or: [{ _id: new ObjectId(targetId) }, { _id: targetId }, { id: targetId }] };
      }
      return { $or: [{ _id: targetId }, { id: targetId }] };
    };

    const redemption = await redemptionsCol.findOne(safeFilter(redemptionId));
    if (!redemption) {
      return NextResponse.json({ success: false, error: 'Redemption not found.' }, { status: 404 });
    }

    const user = await usersCol.findOne(safeFilter(redemption.userId));

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

    // ACTION: APPROVE / DISPATCH PAYOUT
    if (action === 'approve' || action === 'finance_dispatch' || action === 'coin_approve') {
      if (redemption.status === 'approved') {
        return NextResponse.json({ success: false, error: 'Redemption is already approved.' }, { status: 400 });
      }

      await redemptionsCol.updateOne(
        { _id: redemption._id },
        {
          $set: {
            status: 'approved',
            stage: 'completed',
            processedBy: `${session.username} (${session.role})`,
            approvedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      // Record dispatch in ledger (wallet balance is untouched as winnings were in external game)
      await ledgerCol.insertOne({
        userId: redemption.userId,
        username: redemption.username,
        type: 'redemption_payout',
        currency: 'SC',
        amount: redemption.amount,
        balanceBefore: user ? user.balanceSC || 0 : 0,
        balanceAfter: user ? user.balanceSC || 0 : 0,
        performedBy: session.username,
        staffRole: session.role,
        referenceId: redemptionId,
        notes: `Cashout approved & dispatched ($${redemption.amount} SC) via ${redemption.payoutMethod} to tag ${redemption.destinationTag || redemption.destinationAddress}`,
        createdAt: new Date(),
      });

      // Email notification if player has email
      if (user?.email) {
        sendEmail({
          to: user.email,
          subject: 'Players Paradise Cashout Dispatched!',
          html: `<p>Hi ${user.username}, your cashout of $${redemption.amount} via ${redemption.payoutMethod} to ${redemption.destinationTag || redemption.destinationAddress} has been approved and dispatched!</p>`,
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, message: `Cashout of $${redemption.amount} approved and marked as dispatched to ${redemption.username}!` });
    }

    // ACTION: REJECT PAYOUT WITH MANDATORY NOTE
    if (action === 'reject' || action === 'finance_reject' || action === 'coin_reject') {
      const reason = rejectReason || 'Game winning screenshot or payout tag could not be verified.';

      await redemptionsCol.updateOne(
        { _id: redemption._id },
        {
          $set: {
            status: 'rejected',
            stage: 'rejected',
            rejectReason: reason,
            processedBy: `${session.username} (${session.role})`,
            rejectedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      await ledgerCol.insertOne({
        userId: redemption.userId,
        username: redemption.username,
        type: 'redemption_rejected',
        currency: 'SC',
        amount: redemption.amount,
        balanceBefore: user ? user.balanceSC || 0 : 0,
        balanceAfter: user ? user.balanceSC || 0 : 0,
        performedBy: session.username,
        staffRole: session.role,
        referenceId: redemptionId,
        notes: `Cashout rejected by staff: ${reason}`,
        createdAt: new Date(),
      });

      return NextResponse.json({ success: true, message: 'Cashout rejected. Rejection reason saved and sent to player.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
