import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getSessionUser, getAdminSessionUser, ROLES, safeIdFilter } from '@/lib/auth';
import { notifyPlayer, notifyStaff } from '@/lib/notify';
import { findUserGameAccount } from '@/lib/gameAccounts';
import { cache } from '@/lib/cache';

const STAFF_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.OPERATION_ADMIN,
  ROLES.FINANCIAL_MANAGER,
  ROLES.COIN_MANAGER,
  ROLES.CHAT_SUPPORT,
  'super_admin',
  'admin',
  'operation_admin',
  'financial_manager',
  'coin_manager',
  'chat_support',
];

// GET Account Requests
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status');
    const type = searchParams.get('type'); // 'ACCOUNT_CREATION' | 'COIN_LOAD' | 'all'

    const db = await getDb();
    const query = {};

    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      query.userEmail = cleanEmail;

      // Non-blocking background auto-cleanup of stale rejected requests for games the user already has active credentials for
      db.collection('gameAccounts')
        .find({ userEmail: cleanEmail }, { projection: { gameTitle: 1 } })
        .toArray()
        .then((activeAccounts) => {
          const activeTitles = (activeAccounts || []).map((a) => a.gameTitle).filter(Boolean);
          if (activeTitles.length > 0) {
            return db.collection('accountRequests').deleteMany({
              userEmail: cleanEmail,
              gameTitle: { $in: activeTitles },
              status: { $in: ['REJECTED', 'CANCELLED'] },
            });
          }
        })
        .catch(() => {});
    }
    if (status && status !== 'all') {
      query.status = status.toUpperCase();
    }

    if (type === 'ACCOUNT_CREATION') {
      query.$and = [
        {
          $or: [
            { requestType: 'ACCOUNT_CREATION' },
            {
              $and: [
                { requestType: { $ne: 'COIN_LOAD' } },
                { $or: [{ transferAmount: { $lte: 0 } }, { transferAmount: { $exists: false } }, { transferAmount: null }] }
              ]
            }
          ]
        }
      ];
    } else if (type === 'COIN_LOAD') {
      query.$and = [
        {
          $or: [
            { requestType: 'COIN_LOAD' },
            {
              $and: [
                { requestType: { $ne: 'ACCOUNT_CREATION' } },
                { transferAmount: { $gt: 0 } }
              ]
            }
          ]
        }
      ];
    }

    const requests = await db
      .collection('accountRequests')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    const responsePayload = {
      success: true,
      accountRequests: requests.map(r => ({
        id: r._id.toString(),
        userEmail: r.userEmail,
        userName: r.userName || r.userEmail?.split('@')[0],
        gameTitle: r.gameTitle,
        gameId: r.gameId || '',
        requestType: r.requestType || (Number(r.transferAmount || 0) > 0 ? 'COIN_LOAD' : 'ACCOUNT_CREATION'),
        status: r.status || 'PENDING',
        gameAccountUsername: r.gameAccountUsername || '',
        gameAccountPassword: r.gameAccountPassword || '',
        transferAmount: Number(r.transferAmount || 0),
        pendingCoinLoadAmount: Number(r.pendingCoinLoadAmount || 0),
        depositAmount: Number(r.depositAmount || 0),
        bonusSC: Number(r.bonusSC || 0),
        bonusPercent: Number(r.bonusPercent || 0),
        sourceDepositId: r.sourceDepositId || '',
        coinLoadQueued: Boolean(r.coinLoadQueued),
        rejectionReason: r.rejectionReason || r.rejectReason || '',
        freeplayPending: Boolean(r.freeplayPending),
        freeplayAmount: Number(r.freeplayAmount || 0),
        freeplayScreenshot: r.freeplayScreenshot || r.screenshot || '',
        freeplayTaskId: r.freeplayTaskId || '',
        notes: r.notes || '',
        createdAt: r.createdAt || new Date(),
      })),
    };

    return NextResponse.json(responsePayload);
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST - User requests an account or loads coins for a game
export async function POST(req) {
  try {
    const session = await getSessionUser();
    const body = await req.json();
    const userEmail = (session?.email || body.userEmail || '').toLowerCase().trim();
    const userName = session?.username || body.userName || userEmail.split('@')[0];
    const gameTitle = String(body.gameTitle || '').trim();
    const gameId = body.gameId || '';

    const transferAmount = Math.max(0, Number(body.transferAmount || 0));
    const requestType = body.requestType || (transferAmount > 0 ? 'COIN_LOAD' : 'ACCOUNT_CREATION');

    if (!userEmail || !gameTitle) {
      return NextResponse.json({ success: false, message: 'Game title and user email are required.' }, { status: 400 });
    }

    const db = await getDb();
    const requestsCol = db.collection('accountRequests');
    const usersCol = db.collection('users');
    const ledgerCol = db.collection('ledger');

    let user = null;
    if (session?.userId) {
      try {
        user = await usersCol.findOne(safeIdFilter(session.userId));
      } catch (_) {}
    }
    if (!user) {
      user = await usersCol.findOne({
        $or: [
          { email: userEmail },
          { email: { $regex: new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { username: userName },
          { username: { $regex: new RegExp(`^${userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        ],
      });
    }
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found.' }, { status: 404 });
    }

    const currentSC = Number(user.balanceSC || 0);
    const frozen = Math.max(0, Number(user.frozenBalance || 0));
    const available = Math.max(0, Number((currentSC - frozen).toFixed(2)));

    // Verify player is not trying to load more than available balance (for COIN_LOAD)
    if (requestType === 'COIN_LOAD') {
      if (transferAmount <= 0) {
        return NextResponse.json({
          success: false,
          message: 'Please specify a coin amount greater than $0 to load into game.',
        }, { status: 400 });
      }
      if (transferAmount > available) {
        return NextResponse.json({
          success: false,
          message: `Cannot load $${transferAmount.toFixed(2)} SC. You only have $${available.toFixed(2)} SC available ($${frozen.toFixed(2)} currently frozen in processing).`,
        }, { status: 400 });
      }
    }

    // If this is an ACCOUNT_CREATION request, check if user ALREADY has credentials generated
    const cleanUserEmail = userEmail.toLowerCase().trim();
    const emailFilter = cleanUserEmail === userEmail.trim() ? cleanUserEmail : { $in: [cleanUserEmail, userEmail.trim()] };
    const cleanGameTitle = gameTitle.trim();

    if (requestType !== 'COIN_LOAD') {
      const gameAccountsCol = db.collection('gameAccounts');

      // 1. Check if user already has active credentials in gameAccounts collection
      const existingAccount = await gameAccountsCol.findOne({
        userEmail: emailFilter,
        gameTitle: cleanGameTitle,
        status: 'READY',
      });

      if (existingAccount) {
        return NextResponse.json({
          success: false,
          alreadyHasAccount: true,
          message: `You already have active credentials for ${existingAccount.gameTitle || gameTitle} (Username: ${existingAccount.username}). You cannot request duplicate credentials.`,
          gameAccount: {
            gameTitle: existingAccount.gameTitle,
            username: existingAccount.username,
            password: existingAccount.password,
          },
        }, { status: 400 });
      }

      // 2. Check if user already has an approved READY request in accountRequests
      const existingReadyRequest = await requestsCol.findOne({
        userEmail: emailFilter,
        gameTitle: cleanGameTitle,
        status: 'READY',
      });

      if (existingReadyRequest) {
        return NextResponse.json({
          success: false,
          alreadyHasAccount: true,
          message: `Your credentials for ${existingReadyRequest.gameTitle || gameTitle} are already generated! (Username: ${existingReadyRequest.gameAccountUsername || 'Ready'}). You can view them under My Game IDs.`,
          gameAccount: {
            gameTitle: existingReadyRequest.gameTitle,
            username: existingReadyRequest.gameAccountUsername,
            password: existingReadyRequest.gameAccountPassword,
          },
        }, { status: 400 });
      }
    }

    // Check if player already has a PENDING request for this game of this exact type
    const existingPendingQuery = {
      userEmail: emailFilter,
      gameTitle: cleanGameTitle,
      status: 'PENDING',
    };
    if (requestType === 'COIN_LOAD') {
      existingPendingQuery.$or = [
        { requestType: 'COIN_LOAD' },
        { transferAmount: { $gt: 0 } },
      ];
    } else {
      existingPendingQuery.$or = [
        { requestType: 'ACCOUNT_CREATION' },
        {
          $and: [
            { requestType: { $ne: 'COIN_LOAD' } },
            { $or: [{ transferAmount: { $lte: 0 } }, { transferAmount: { $exists: false } }] },
          ],
        },
      ];
    }

    const existingPending = await requestsCol.findOne(existingPendingQuery);

    if (existingPending) {
      const typeLabel = requestType === 'COIN_LOAD' ? 'coin load' : 'account creation';
      return NextResponse.json({
        success: false,
        isPending: true,
        message: `You already have a pending ${typeLabel} request for ${gameTitle}. Please wait for staff approval.`,
      }, { status: 400 });
    }

    // 1. FREEZE coins if this is a COIN_LOAD
    if (requestType === 'COIN_LOAD' && transferAmount > 0) {
      await usersCol.updateOne(
        { _id: user._id },
        { $inc: { frozenBalance: transferAmount } }
      );

      await ledgerCol.insertOne({
        userId: user._id.toString(),
        username: user.username,
        type: 'game_load_freeze',
        currency: 'SC',
        amount: transferAmount,
        balanceBefore: currentSC,
        balanceAfter: currentSC,
        frozenAmount: transferAmount,
        performedBy: 'player',
        referenceId: gameTitle,
        notes: `Frozen $${transferAmount.toFixed(2)} SC in escrow for loading into ${gameTitle}`,
        createdAt: new Date(),
      });
    }

    // 2. Resolve Game Account Username if existing for this player and game
    let resolvedGameUsername = String(body.gameAccountUsername || '').trim();
    if (!resolvedGameUsername && gameTitle) {
      const accCheck = await findUserGameAccount(
        db,
        {
          userId: user?._id || session?.userId,
          userEmail,
          username: userName,
        },
        gameTitle
      );
      if (accCheck.exists) {
        resolvedGameUsername = accCheck.username;
      }
    }

    // 3. Create the Request with explicit requestType and attached gameAccountUsername
    const newRequest = {
      userEmail,
      userName,
      gameTitle,
      gameId,
      gameAccountUsername: resolvedGameUsername || '',
      requestType,
      transferAmount,
      status: 'PENDING',
      createdAt: new Date(),
    };

    const res = await requestsCol.insertOne(newRequest);
    cache.invalidatePrefix('account_requests');

    // Notify staff desk immediately (Never sent to players)
    notifyStaff({
      title: requestType === 'COIN_LOAD' ? '⚡ New Coin Load Request' : '🎮 New Game ID Request',
      message: `@${userName} requested ${requestType === 'COIN_LOAD' ? `$${transferAmount.toFixed(2)} SC loaded into ${gameTitle}` : `credentials for ${gameTitle}`}.`,
      type: requestType === 'COIN_LOAD' ? 'coin_load' : 'account_request',
      data: {
        requestId: res.insertedId.toString(),
        url: requestType === 'COIN_LOAD' ? '/admin?tab=coins_allotment' : '/admin?tab=account_requests',
      },
    });

    const insertedIdStr = res.insertedId.toString();
    return NextResponse.json({
      success: true,
      requestId: insertedIdStr,
      request: {
        id: insertedIdStr,
        _id: insertedIdStr,
        ...newRequest,
      },
      message: requestType === 'COIN_LOAD'
        ? `Load request for ${gameTitle} submitted! $${transferAmount.toFixed(2)} SC is frozen in escrow until staff approves or rejects.`
        : `Account request for ${gameTitle} submitted! Staff will issue your credentials shortly.`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// PUT - Admin approves or cancels account or load request
export async function PUT(req) {
  try {
    const session = (await getAdminSessionUser()) || (await getSessionUser());
    if (!session || !STAFF_ROLES.includes(session.role)) {
      return NextResponse.json({ success: false, message: 'Unauthorized staff action.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, username, password } = body;

    if (!id || !action) {
      return NextResponse.json({ success: false, message: 'ID and action are required.' }, { status: 400 });
    }

    const db = await getDb();
    const requestsCol = db.collection('accountRequests');
    const targetRequest = await requestsCol.findOne(safeIdFilter(id));

    if (!targetRequest) {
      return NextResponse.json({ success: false, message: 'Request not found.' }, { status: 404 });
    }

    const usersCol = db.collection('users');
    const ledgerCol = db.collection('ledger');
    const cleanEmail = targetRequest.userEmail.toLowerCase().trim();
    const cleanTitle = targetRequest.gameTitle;
    const isCoinLoadRequest =
      targetRequest.requestType === 'COIN_LOAD' || Number(targetRequest.transferAmount || 0) > 0;
    const originalFrozen = Number(targetRequest.transferAmount || 0);
    const pendingDepositLoad = !isCoinLoadRequest && !targetRequest.coinLoadQueued
      ? Number(targetRequest.pendingCoinLoadAmount || 0)
      : 0;

    // Allow staff to adjust load amount if specified (for COIN_LOAD requests)
    const finalAmount = isCoinLoadRequest
      ? (body.transferAmount !== undefined ? Math.max(0, Number(body.transferAmount)) : originalFrozen)
      : 0;

    if (action === 'approve') {
      const gameAccountsCol = db.collection('gameAccounts');
      let autoCoinLoadCreated = false;
      let queuedLoadAmount = 0;

      // 1. If this is a COIN_LOAD approval, permanently deduct balance and clear frozen escrow
      if (isCoinLoadRequest && (originalFrozen > 0 || finalAmount > 0)) {
        const user = await usersCol.findOne({ email: cleanEmail });
        if (user) {
          const oldSC = Number(user.balanceSC || 0);
          const newSC = Number(Math.max(0, oldSC - finalAmount).toFixed(2));
          const oldFrozen = Math.max(0, Number(user.frozenBalance || 0));
          const newFrozen = Number(Math.max(0, oldFrozen - originalFrozen).toFixed(2));

          await usersCol.updateOne(
            { _id: user._id },
            {
              $set: {
                balanceSC: newSC,
                frozenBalance: newFrozen,
              },
            }
          );

          if (finalAmount > 0) {
            await ledgerCol.insertOne({
              userId: user._id.toString(),
              username: user.username,
              type: 'game_transfer',
              currency: 'SC',
              amount: -finalAmount,
              balanceBefore: oldSC,
              balanceAfter: newSC,
              performedBy: session.username,
              staffRole: session.role,
              referenceId: targetRequest._id.toString(),
              notes: `Game account coin load into ${cleanTitle} (Account ID: ${username || targetRequest.gameAccountUsername || targetRequest.userName})${finalAmount !== originalFrozen ? ` [Amount adjusted by admin from $${originalFrozen} to $${finalAmount}]` : ''}`,
              createdAt: new Date(),
            });
          }
        }
      }

      // 2. Update request status to READY and save final transferAmount
      const issuedUsername = username || targetRequest.gameAccountUsername || cleanEmail.split('@')[0];
      const issuedPassword = password || targetRequest.gameAccountPassword || 'VegasWin777!';

      await requestsCol.updateOne(
        { _id: targetRequest._id },
        {
          $set: {
            status: 'READY',
            transferAmount: finalAmount,
            originalTransferAmount: originalFrozen,
            gameAccountUsername: issuedUsername,
            gameAccountPassword: issuedPassword,
            coinLoadQueued: pendingDepositLoad > 0 ? true : Boolean(targetRequest.coinLoadQueued),
            approvedBy: session.username,
            approvedAt: new Date(),
          },
        }
      );

      // 3. Insert or update gameAccounts collection
      await gameAccountsCol.updateOne(
        { userEmail: cleanEmail, gameTitle: cleanTitle },
        {
          $set: {
            userEmail: cleanEmail,
            gameTitle: cleanTitle,
            username: issuedUsername,
            password: issuedPassword,
            status: 'READY',
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );

      // 3b. STAGE 2 -> STAGE 3 HANDOFF:
      // If this was an ACCOUNT_CREATION request backed by an approved Deposit (pendingCoinLoadAmount > 0),
      // automatically queue a PENDING COIN_LOAD request in Coins Allotment Desk with the player's deposit + bonus!
      let autoCreatedCoinLoad = null;
      if (!isCoinLoadRequest && pendingDepositLoad > 0) {
        autoCoinLoadCreated = true;
        queuedLoadAmount = pendingDepositLoad;

        const depAmt = Number(targetRequest.depositAmount || 0);
        const bonAmt = Number(targetRequest.bonusSC || 0);
        const bonPct = Number(targetRequest.bonusPercent || 0);
        const breakdownNote = bonAmt > 0
          ? `Deposit $${depAmt.toFixed(2)} + Bonus $${bonAmt.toFixed(2)} (${bonPct}%) = $${pendingDepositLoad.toFixed(2)} SC • Newly Created ID: @${issuedUsername}`
          : `Approved Deposit = $${pendingDepositLoad.toFixed(2)} SC • Newly Created ID: @${issuedUsername}`;

        const coinLoadDoc = {
          userEmail: cleanEmail,
          userName: targetRequest.userName || cleanEmail.split('@')[0],
          gameTitle: cleanTitle,
          gameId: targetRequest.gameId || cleanTitle.toLowerCase().replace(/\s+/g, '-'),
          gameAccountUsername: issuedUsername,
          gameAccountPassword: issuedPassword,
          requestType: 'COIN_LOAD',
          transferAmount: pendingDepositLoad,
          depositAmount: depAmt,
          bonusSC: bonAmt,
          bonusPercent: bonPct,
          sourceDepositId: targetRequest.sourceDepositId || '',
          sourceAccountRequestId: targetRequest._id.toString(),
          status: 'PENDING',
          notes: breakdownNote,
          createdAt: new Date(),
        };
        const loadInsert = await requestsCol.insertOne(coinLoadDoc);
        autoCreatedCoinLoad = {
          id: loadInsert.insertedId.toString(),
          _id: loadInsert.insertedId.toString(),
          ...coinLoadDoc,
        };

        notifyStaff({
          title: '⚡ Stage 3/3: Coin Load Ready (ID Created)',
          message: `Credentials (@${issuedUsername}) created for @${targetRequest.userName || cleanEmail.split('@')[0]} on ${cleanTitle}. Allot $${pendingDepositLoad.toFixed(2)} SC (Deposit + Bonus) now!`,
          type: 'coin_load',
          data: {
            url: '/admin?tab=coins_allotment',
          },
        });
      }

      // 4. If this is a Freeplay Task request, mark 1-time Freeplay as claimed for user
      if (targetRequest.freeplayPending) {
        await usersCol.updateOne(
          { email: cleanEmail },
          {
            $set: {
              freeplayClaimed: true,
              freeplayClaimedAt: new Date(),
              freeplayGameTitle: cleanTitle,
            },
          }
        );
        await db.collection('freeplay_tasks').updateMany(
          { email: cleanEmail, status: 'pending' },
          {
            $set: {
              status: 'approved',
              approvedAt: new Date(),
              approvedBy: session.username,
            },
          }
        );
      }

      // Clean up any older REJECTED or CANCELLED requests for this user and game
      try {
        await requestsCol.deleteMany({
          userEmail: cleanEmail,
          gameTitle: cleanTitle,
          status: { $in: ['REJECTED', 'CANCELLED'] },
        });
      } catch (cleanErr) {
        console.error('Error cleaning up rejected requests on approval:', cleanErr);
      }

      // Instant in-app & push notification
      if (isCoinLoadRequest && finalAmount > 0) {
        notifyPlayer({
          userEmail: cleanEmail,
          title: `Game Loaded: ${cleanTitle}! ⚡`,
          message: `$${finalAmount.toFixed(2)} SC loaded into your ${cleanTitle} account (@${issuedUsername})! Good luck!`,
          type: 'coin_load_approved',
          data: { gameTitle: cleanTitle, amount: String(finalAmount) },
        });
      } else if (autoCoinLoadCreated) {
        notifyPlayer({
          userEmail: cleanEmail,
          title: `Step 3/3: ${cleanTitle} ID Ready & Coins Loading! 🎮⚡`,
          message: `Your ${cleanTitle} ID (@${issuedUsername}) has been created! Your $${queuedLoadAmount.toFixed(2)} SC (Deposit + Bonus) has been forwarded to the Coins Allotment Desk for instant loading.`,
          type: 'account_ready',
          data: { gameTitle: cleanTitle },
        });
      } else {
        notifyPlayer({
          userEmail: cleanEmail,
          title: `Game ID Ready: ${cleanTitle}! 🎮`,
          message: `Your ${cleanTitle} credentials have been issued! Username: ${issuedUsername}`,
          type: 'account_ready',
          data: { gameTitle: cleanTitle },
        });
      }

      cache.invalidatePrefix('account_requests');
      return NextResponse.json({
        success: true,
        autoCoinLoadCreated,
        autoCreatedCoinLoad,
        queuedLoadAmount,
        gameTitle: cleanTitle,
        username: issuedUsername,
        userName: targetRequest.userName || cleanEmail.split('@')[0],
        message: isCoinLoadRequest
          ? `Coin load for ${cleanTitle} approved! $${finalAmount.toFixed(2)} SC deducted from player balance.`
          : autoCoinLoadCreated
          ? `Credentials (@${issuedUsername}) for ${cleanTitle} issued! Automatically queued $${queuedLoadAmount.toFixed(2)} SC (Deposit + Bonus) in Coins Allotment Desk.`
          : `Credentials for ${cleanTitle} issued successfully!`,
      });
    } else if (action === 'cancel' || action === 'reject') {
      const reason = body.reason || body.rejectionReason || 'Staff desk rejected request or platform currently unavailable.';
      const amountToUnfreeze = isCoinLoadRequest ? originalFrozen : pendingDepositLoad;

      // Unfreeze player's coins so they return to available balance
      if (amountToUnfreeze > 0 && (targetRequest.status || '').toUpperCase() === 'PENDING') {
        const user = await usersCol.findOne({ email: cleanEmail });
        if (user) {
          const oldFrozen = Math.max(0, Number(user.frozenBalance || 0));
          const newFrozen = Number(Math.max(0, oldFrozen - amountToUnfreeze).toFixed(2));
          await usersCol.updateOne(
            { _id: user._id },
            { $set: { frozenBalance: newFrozen } }
          );

          await ledgerCol.insertOne({
            userId: user._id.toString(),
            username: user.username,
            type: 'game_load_unfreeze',
            currency: 'SC',
            amount: amountToUnfreeze,
            balanceBefore: user.balanceSC,
            balanceAfter: user.balanceSC,
            performedBy: session.username,
            staffRole: session.role,
            referenceId: targetRequest._id.toString(),
            notes: `Game request rejected ($${amountToUnfreeze.toFixed(2)} SC unfrozen & returned to wallet): ${reason}`,
            createdAt: new Date(),
          });
        }
      }

      await requestsCol.updateOne(
        { _id: targetRequest._id },
        {
          $set: {
            status: 'REJECTED',
            rejectionReason: reason,
            cancelledBy: session.username,
            cancelledAt: new Date(),
          },
        }
      );

      // If this was a Freeplay request, update freeplay_tasks status
      if (targetRequest.freeplayPending) {
        await db.collection('freeplay_tasks').updateMany(
          { email: cleanEmail, status: 'pending' },
          {
            $set: {
              status: 'rejected',
              rejectedAt: new Date(),
              rejectedBy: session.username,
              rejectionReason: reason,
            },
          }
        );
      }

      notifyPlayer({
        userEmail: cleanEmail,
        title: `${cleanTitle} Request Update ⚠️`,
        message: `Your request for ${cleanTitle} was rejected: ${reason}`,
        type: 'account_rejected',
        data: { gameTitle: cleanTitle },
      });

      cache.invalidatePrefix('account_requests');
      return NextResponse.json({
        success: true,
        message: 'Request rejected. Coins unfrozen and reason note logged for player.',
      });
    }

    return NextResponse.json({ success: false, message: 'Unknown action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// DELETE - Dismiss or remove an account request
export async function DELETE(req) {
  try {
    const session = (await getAdminSessionUser()) || (await getSessionUser());
    const isStaff = session && STAFF_ROLES.includes(session.role);

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    let body = {};
    try {
      body = await req.json();
    } catch {}

    if (!id && body.id) id = body.id;

    const db = await getDb();
    const requestsCol = db.collection('accountRequests');

    // Bulk dismiss historical freeplay requests
    if (body.clearAllOldFreeplay && isStaff) {
      const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const res = await requestsCol.updateMany(
        { freeplayPending: true, status: 'PENDING', createdAt: { $lt: cutoff } },
        { $set: { status: 'DISMISSED', dismissalReason: 'Staff bulk dismissed', dismissedBy: session.username, dismissedAt: new Date() } }
      );
      cache.invalidatePrefix('account_requests');
      return NextResponse.json({ success: true, count: res.modifiedCount, message: 'Historical freeplay requests dismissed.' });
    }

    // Bulk delete by ids array
    if (Array.isArray(body.ids) && body.ids.length > 0 && isStaff) {
      const filters = body.ids.map(i => safeIdFilter(i));
      await requestsCol.deleteMany({ $or: filters });
      cache.invalidatePrefix('account_requests');
      return NextResponse.json({ success: true, message: `${body.ids.length} requests dismissed successfully.` });
    }

    if (!id) {
      return NextResponse.json({ success: false, message: 'ID required.' }, { status: 400 });
    }

    const target = await requestsCol.findOne(safeIdFilter(id));
    if (!target) {
      cache.invalidatePrefix('account_requests');
      return NextResponse.json({
        success: true,
        alreadyDeleted: true,
        message: 'Request already removed.',
      });
    }

    // Only allow player if it's their own request, or staff
    const isOwner = session && session.email?.toLowerCase().trim() === target.userEmail?.toLowerCase().trim();

    if (!isOwner && !isStaff) {
      return NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 403 });
    }

    // If dismissing a PENDING request that had frozen escrow coins, unfreeze them safely
    if ((target.status || '').toUpperCase() === 'PENDING') {
      const frozenToRelease =
        target.requestType === 'COIN_LOAD' || Number(target.transferAmount || 0) > 0
          ? Number(target.transferAmount || 0)
          : !target.coinLoadQueued
          ? Number(target.pendingCoinLoadAmount || 0)
          : 0;
      if (frozenToRelease > 0 && target.userEmail) {
        const cleanTargetEmail = target.userEmail.toLowerCase().trim();
        const u = await db.collection('users').findOne({ email: cleanTargetEmail });
        if (u) {
          const nextFrozen = Number(Math.max(0, Number(u.frozenBalance || 0) - frozenToRelease).toFixed(2));
          await db.collection('users').updateOne({ _id: u._id }, { $set: { frozenBalance: nextFrozen } });
        }
      }
    }

    await requestsCol.deleteOne(safeIdFilter(id));
    cache.invalidatePrefix('account_requests');
    return NextResponse.json({ success: true, message: 'Request dismissed successfully.' });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
