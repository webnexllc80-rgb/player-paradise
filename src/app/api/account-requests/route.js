import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';

// GET Account Requests
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status');

    const db = await getDb();
    const query = {};

    if (email) {
      query.userEmail = email.toLowerCase().trim();
    }
    if (status && status !== 'all') {
      query.status = status.toUpperCase();
    }

    const requests = await db
      .collection('accountRequests')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      accountRequests: requests.map(r => ({
        id: r._id.toString(),
        userEmail: r.userEmail,
        userName: r.userName || r.userEmail?.split('@')[0],
        gameTitle: r.gameTitle,
        gameId: r.gameId || '',
        status: r.status || 'PENDING',
        gameAccountUsername: r.gameAccountUsername || '',
        gameAccountPassword: r.gameAccountPassword || '',
        transferAmount: Number(r.transferAmount || 0),
        rejectionReason: r.rejectionReason || r.rejectReason || '',
        createdAt: r.createdAt || new Date(),
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST - User requests an account for a game
export async function POST(req) {
  try {
    const session = await getSessionUser();
    const body = await req.json();
    const userEmail = (session?.email || body.userEmail || '').toLowerCase().trim();
    const userName = session?.username || body.userName || userEmail.split('@')[0];
    const gameTitle = String(body.gameTitle || '').trim();
    const gameId = body.gameId || '';

    const transferAmount = Number(body.transferAmount || 0);

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
        user = await usersCol.findOne({ _id: new ObjectId(session.userId) });
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

    // Verify player is not trying to load more than available balance
    if (transferAmount > available) {
      return NextResponse.json({
        success: false,
        message: `Cannot load $${transferAmount.toFixed(2)} SC. You only have $${available.toFixed(2)} SC available ($${frozen.toFixed(2)} currently frozen in processing).`,
      }, { status: 400 });
    }

    // Check if player already has a PENDING request for this game
    const existingPending = await requestsCol.findOne({
      userEmail,
      gameTitle: new RegExp(`^${gameTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      status: 'PENDING',
    });

    if (existingPending) {
      return NextResponse.json({
        success: false,
        message: `You already have a pending load request for ${gameTitle} ($${Number(existingPending.transferAmount || 0).toFixed(2)} SC). Please wait for staff approval.`,
      }, { status: 400 });
    }

    // 1. FREEZE the coins immediately in user wallet so they cannot be spent elsewhere
    if (transferAmount > 0) {
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

    // 2. Create the Load / Account Request
    const newRequest = {
      userEmail,
      userName,
      gameTitle,
      gameId,
      transferAmount,
      status: 'PENDING',
      createdAt: new Date(),
    };

    const res = await requestsCol.insertOne(newRequest);

    return NextResponse.json({
      success: true,
      requestId: res.insertedId.toString(),
      message: `Load request for ${gameTitle} submitted! $${transferAmount.toFixed(2)} SC is frozen in escrow until staff approves or rejects.`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// PUT - Admin approves or cancels account request
export async function PUT(req) {
  try {
    const session = await getSessionUser();
    if (!session || !['super_admin', 'operation_admin', 'financial_manager', 'coin_manager', 'chat_support'].includes(session.role)) {
      return NextResponse.json({ success: false, message: 'Unauthorized staff action.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, username, password } = body;

    if (!id || !action) {
      return NextResponse.json({ success: false, message: 'ID and action are required.' }, { status: 400 });
    }

    const db = await getDb();
    const requestsCol = db.collection('accountRequests');
    const targetRequest = await requestsCol.findOne({ _id: new ObjectId(id) });

    if (!targetRequest) {
      return NextResponse.json({ success: false, message: 'Request not found.' }, { status: 404 });
    }

    const usersCol = db.collection('users');
    const ledgerCol = db.collection('ledger');
    const cleanEmail = targetRequest.userEmail.toLowerCase().trim();
    const cleanTitle = targetRequest.gameTitle;
    const transferAmount = Number(targetRequest.transferAmount || 0);

    if (action === 'approve') {
      const gameAccountsCol = db.collection('gameAccounts');

      // 1. Permanently deduct balance and clear frozen escrow
      if (transferAmount > 0) {
        const user = await usersCol.findOne({ email: cleanEmail });
        if (user) {
          const oldSC = Number(user.balanceSC || 0);
          const newSC = Number(Math.max(0, oldSC - transferAmount).toFixed(2));

          await usersCol.updateOne(
            { _id: user._id },
            {
              $inc: {
                balanceSC: -transferAmount,
                frozenBalance: -transferAmount,
              },
            }
          );

          await ledgerCol.insertOne({
            userId: user._id.toString(),
            username: user.username,
            type: 'game_transfer',
            currency: 'SC',
            amount: -transferAmount,
            balanceBefore: oldSC,
            balanceAfter: newSC,
            performedBy: session.username,
            staffRole: session.role,
            referenceId: targetRequest._id.toString(),
            notes: `Game account coin load into ${cleanTitle} (Account ID: ${username || targetRequest.userName})`,
            createdAt: new Date(),
          });
        }
      }

      // 2. Update request status to READY
      await requestsCol.updateOne(
        { _id: targetRequest._id },
        {
          $set: {
            status: 'READY',
            gameAccountUsername: username,
            gameAccountPassword: password,
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
            username: username || cleanEmail.split('@')[0],
            password: password || 'VegasWin777!',
            status: 'READY',
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );

      return NextResponse.json({
        success: true,
        message: `Coin load for ${cleanTitle} approved! $${transferAmount.toFixed(2)} SC deducted from player balance.`,
      });
    } else if (action === 'cancel' || action === 'reject') {
      const reason = body.reason || body.rejectionReason || 'Staff desk rejected request or platform currently unavailable.';

      // Unfreeze player's coins so they return to available balance
      if (transferAmount > 0) {
        const user = await usersCol.findOne({ email: cleanEmail });
        if (user) {
          await usersCol.updateOne(
            { _id: user._id },
            { $inc: { frozenBalance: -transferAmount } }
          );

          await ledgerCol.insertOne({
            userId: user._id.toString(),
            username: user.username,
            type: 'game_load_unfreeze',
            currency: 'SC',
            amount: transferAmount,
            balanceBefore: user.balanceSC,
            balanceAfter: user.balanceSC,
            performedBy: session.username,
            staffRole: session.role,
            referenceId: targetRequest._id.toString(),
            notes: `Game coin load rejected ($${transferAmount} SC unfrozen & returned): ${reason}`,
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
