import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES, getUserFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { sendEmail } from '@/lib/email';
import { notifyPlayer } from '@/lib/notify';
import { findUserGameAccount } from '@/lib/gameAccounts';

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
    const lightweight = searchParams.get('lightweight') === 'true';

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

    const projection = lightweight ? { gameScreenshot: 0, qrCodeImage: 0 } : {};
    const items = await redemptionsCol.find(query, { projection }).sort({ createdAt: -1 }).limit(100).toArray();

    return NextResponse.json({
      success: true,
      redemptions: items.map(r => ({
        id: r._id.toString(),
        userId: r.userId,
        username: r.username,
        amount: r.amount,
        gameTitle: r.gameTitle || 'Standard Platform',
        gameAccountUsername: r.gameAccountUsername || '',
        gameScreenshot: r.gameScreenshot
          ? (r.gameScreenshot.startsWith('data:') && r.gameScreenshot.length > 50000
              ? `/api/payments/withdraw/proof?id=${r._id}&type=gameScreenshot`
              : r.gameScreenshot)
          : null,
        qrCodeImage: r.qrCodeImage
          ? (r.qrCodeImage.startsWith('data:') && r.qrCodeImage.length > 50000
              ? `/api/payments/withdraw/proof?id=${r._id}&type=qrCodeImage`
              : r.qrCodeImage)
          : null,
        hasScreenshot: Boolean(r.gameScreenshot),
        hasQrCode: Boolean(r.qrCodeImage),
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

// Safe ID filter helper
const safeFilter = (targetId) => {
  if (!targetId) return { _id: null };
  const is24Hex = typeof targetId === 'string' && targetId.length === 24 && /^[0-9a-fA-F]{24}$/.test(targetId);
  if (is24Hex && ObjectId.isValid(targetId)) {
    return { $or: [{ _id: new ObjectId(targetId) }, { _id: targetId }, { id: targetId }] };
  }
  return { $or: [{ _id: targetId }, { id: targetId }] };
};

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

    // Verify user has sufficient available SC balance (Total SC - currently frozen)
    const currentSC = Number(user.balanceSC ?? user.balance ?? 0);
    const frozen = Number(user.frozenBalance || 0);
    const availableSC = Math.max(0, Number((currentSC - frozen).toFixed(2)));

    // Verify player has an active game account for this game (Withdrawal blocked without game account!)
    const requestedGame = String(gameTitle || '').trim();
    if (!requestedGame) {
      return NextResponse.json(
        { success: false, error: 'Please select the game platform you won from.' },
        { status: 400 }
      );
    }

    const accountCheck = await findUserGameAccount(
      db,
      {
        userId: user._id,
        userEmail: user.email,
        username: user.username,
      },
      requestedGame
    );

    if (!accountCheck.exists) {
      return NextResponse.json(
        {
          success: false,
          noAccount: true,
          error: `Withdrawal Blocked: You do not have an active game account for "${requestedGame}". You must first create and play on a verified game account before requesting a cashout.`,
        },
        { status: 400 }
      );
    }

    const gameAccountUsername = accountCheck.username;

    if (redeemAmount > availableSC) {
      return NextResponse.json(
        {
          success: false,
          error: `Insufficient redeemable SC balance. Available: $${availableSC.toFixed(2)} SC. (Requested: $${redeemAmount.toFixed(2)} SC)`,
        },
        { status: 400 }
      );
    }

    // Freeze cashout amount in user's wallet escrow
    await usersCol.updateOne(
      safeFilter(user._id),
      { $inc: { frozenBalance: redeemAmount } }
    );

    // Initial cashout must go to Coin Allotment (Coin Operations Desk) first
    const initialStatus = 'pending_coin';
    const initialStage = 'coin_verification';

    // Create Redemption Record
    const insertRes = await redemptionsCol.insertOne({
      userId: user._id.toString(),
      username: user.username,
      amount: redeemAmount,
      gameTitle: requestedGame,
      gameAccountUsername: gameAccountUsername,
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
      balanceBefore: currentSC,
      balanceAfter: currentSC,
      performedBy: 'player',
      referenceId: insertRes.insertedId.toString(),
      notes: `Cashout requested: $${redeemAmount.toFixed(2)} SC for ${requestedGame} (Game Account: @${gameAccountUsername}) via ${payoutMethod} to tag ${finalTag} (Frozen in escrow, routed to Coin Allotment)`,
      createdAt: new Date(),
    });

    notifyPlayer({
      userId: user._id.toString(),
      userEmail: user.email,
      username: user.username,
      title: 'Cashout Request Submitted ⏳',
      message: `Your cashout request for $${redeemAmount.toFixed(2)} SC has been sent to Coin Allotment Desk for game verification.`,
      type: 'withdraw_pending_coin',
    });

    return NextResponse.json({
      success: true,
      message: `Cashout request for $${redeemAmount.toFixed(2)} submitted! It has been routed to Coin Allotment for game screenshot verification.`,
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

    const redemption = await redemptionsCol.findOne(safeFilter(redemptionId));
    if (!redemption) {
      return NextResponse.json({ success: false, error: 'Redemption not found.' }, { status: 404 });
    }

    const user = await usersCol.findOne(getUserFilter({
      userId: redemption.userId,
      username: redemption.username,
      email: redemption.userEmail || redemption.email,
    }));

    // ACTION 1: COIN DESK APPROVAL (Verify game score & forward to Finance / Cashier)
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

      const currentSC = user ? Number(user.balanceSC ?? user.balance ?? 0) : 0;
      await ledgerCol.insertOne({
        userId: redemption.userId,
        username: redemption.username,
        type: 'coin_verification_passed',
        currency: 'SC',
        amount: redemption.amount,
        balanceBefore: currentSC,
        balanceAfter: currentSC,
        performedBy: session.username,
        staffRole: session.role,
        referenceId: redemptionId,
        notes: `Game score screenshot verified for ${redemption.gameTitle || 'platform'}. Forwarded to Finance Ledger for payout dispatch.`,
        createdAt: new Date(),
      });

      notifyPlayer({
        userId: redemption.userId,
        userEmail: user?.email,
        username: redemption.username,
        title: 'Cashout Verified by Coin Desk! 🎮',
        message: `Your winnings of $${redemption.amount} SC from ${redemption.gameTitle} have been verified by Coin Operations and forwarded to Finance Cashier for payout dispatch!`,
        type: 'withdraw_coin_approved',
      });

      return NextResponse.json({
        success: true,
        message: 'Game score verified! Cashout passed to Finance Cashier for payout dispatch.',
      });
    }

    // ACTION 2: COIN DESK REJECTION (Invalid screenshot, wrong score, etc.)
    if (action === 'coin_reject') {
      const reason = rejectReason || 'Game winning screenshot could not be verified or score mismatch.';

      // Unfreeze player's balance
      const currentFrozen = Number(user?.frozenBalance || 0);
      const newFrozen = Math.max(0, Number((currentFrozen - redemption.amount).toFixed(2)));
      await usersCol.updateOne(
        safeFilter(redemption.userId),
        { $set: { frozenBalance: newFrozen } }
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

      const currentSC = user ? Number(user.balanceSC ?? user.balance ?? 0) : 0;
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

      notifyPlayer({
        userId: redemption.userId,
        userEmail: user?.email,
        username: redemption.username,
        title: 'Cashout Rejected by Coin Desk ⚠️',
        message: `Your cashout request ($${redemption.amount} SC) was not approved by Coin Operations: ${reason}. Your balance has been unfrozen.`,
        type: 'withdraw_rejected_by_coin',
      });

      return NextResponse.json({
        success: true,
        message: 'Cashout rejected by Coin Desk. Reason saved and balance unfrozen for player.',
      });
    }

    // ACTION 3: FINANCE DESK APPROVAL & PAYOUT DISPATCH (Permanently deducts balance!)
    if (action === 'approve' || action === 'finance_dispatch') {
      if (redemption.status === 'approved') {
        return NextResponse.json({ success: false, error: 'Redemption is already approved.' }, { status: 400 });
      }

      const withdrawAmount = Number(redemption.amount);
      const currentSC = user ? Number(user.balanceSC ?? user.balance ?? 0) : 0;
      const currentFrozen = user ? Number(user.frozenBalance || 0) : 0;

      const newBalanceSC = Math.max(0, Number((currentSC - withdrawAmount).toFixed(2)));
      const newFrozen = Math.max(0, Number((currentFrozen - withdrawAmount).toFixed(2)));

      // Deduct player balance and clear escrow frozen balance
      await usersCol.updateOne(
        safeFilter(redemption.userId),
        {
          $set: {
            balanceSC: newBalanceSC,
            balance: newBalanceSC,
            frozenBalance: newFrozen,
          },
        }
      );

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

      // Record dispatch in ledger with accurate balanceBefore and balanceAfter
      await ledgerCol.insertOne({
        userId: redemption.userId,
        username: redemption.username,
        type: 'redemption_payout',
        currency: 'SC',
        amount: withdrawAmount,
        balanceBefore: currentSC,
        balanceAfter: newBalanceSC,
        performedBy: session.username,
        staffRole: session.role,
        referenceId: redemptionId,
        notes: `Cashout approved & dispatched ($${withdrawAmount.toFixed(2)} SC deducted from wallet) via ${redemption.payoutMethod} to tag ${redemption.destinationTag || redemption.destinationAddress}`,
        createdAt: new Date(),
      });

      // Email notification if player has email
      if (user?.email) {
        sendEmail({
          to: user.email,
          subject: 'Players Paradise Cashout Dispatched!',
          html: `<p>Hi ${user.username}, your cashout of $${withdrawAmount.toFixed(2)} via ${redemption.payoutMethod} to ${redemption.destinationTag || redemption.destinationAddress} has been approved and dispatched!</p>`,
        }).catch(() => {});
      }

      // Push & In-App Notification
      notifyPlayer({
        userId: redemption.userId,
        userEmail: user?.email,
        username: redemption.username,
        title: 'Cashout Dispatched! 💸',
        message: `Your cashout of $${withdrawAmount.toFixed(2)} via ${redemption.payoutMethod} has been approved and dispatched! $${withdrawAmount.toFixed(2)} SC deducted.`,
        type: 'withdraw_approved',
        data: { amount: String(withdrawAmount), newBalance: String(newBalanceSC) },
      });

      return NextResponse.json({
        success: true,
        newBalance: newBalanceSC,
        message: `Cashout of $${withdrawAmount.toFixed(2)} approved, $${withdrawAmount.toFixed(2)} SC deducted, and dispatched to ${redemption.username}!`,
      });
    }

    // ACTION 4: REJECT PAYOUT (Finance Rejection)
    if (action === 'reject' || action === 'finance_reject') {
      const reason = rejectReason || 'Game winning screenshot or payout tag could not be verified.';

      // Unfreeze player's balance
      const currentFrozen = Number(user?.frozenBalance || 0);
      const newFrozen = Math.max(0, Number((currentFrozen - redemption.amount).toFixed(2)));
      await usersCol.updateOne(
        safeFilter(redemption.userId),
        { $set: { frozenBalance: newFrozen } }
      );

      await redemptionsCol.updateOne(
        { _id: redemption._id },
        {
          $set: {
            status: 'rejected',
            stage: 'rejected',
            rejectReason: reason,
            financeRejectReason: reason,
            processedBy: `${session.username} (${session.role})`,
            rejectedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      const currentSC = user ? Number(user.balanceSC ?? user.balance ?? 0) : 0;
      await ledgerCol.insertOne({
        userId: redemption.userId,
        username: redemption.username,
        type: 'redemption_rejected',
        currency: 'SC',
        amount: redemption.amount,
        balanceBefore: currentSC,
        balanceAfter: currentSC,
        performedBy: session.username,
        staffRole: session.role,
        referenceId: redemptionId,
        notes: `Cashout rejected by finance ($${redemption.amount} SC unfrozen): ${reason}`,
        createdAt: new Date(),
      });

      notifyPlayer({
        userId: redemption.userId,
        userEmail: user?.email,
        username: redemption.username,
        title: 'Cashout Update ⚠️',
        message: `Your cashout request ($${redemption.amount} SC) could not be processed: ${reason}. Your balance has been unfrozen.`,
        type: 'withdraw_rejected',
      });

      return NextResponse.json({
        success: true,
        message: 'Cashout rejected. Rejection reason saved, balance unfrozen, and sent to player.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
