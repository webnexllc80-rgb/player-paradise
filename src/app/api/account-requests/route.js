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

    const session = await getSessionUser();
    const db = await getDb();
    const query = {};

    const isStaff = session && session.role && session.role !== ROLES.PLAYER;

    if (!isStaff) {
      if (session?.email) {
        query.userEmail = session.email.toLowerCase().trim();
      } else if (email) {
        query.userEmail = email.toLowerCase().trim();
      } else {
        return NextResponse.json({ success: true, accountRequests: [] });
      }
    } else {
      if (email) {
        query.userEmail = email.toLowerCase().trim();
      }
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
      accountRequests: requests.map((r) => ({
        id: r._id ? r._id.toString() : r.id,
        userEmail: r.userEmail,
        userName: r.userName || r.userEmail?.split('@')[0],
        gameTitle: r.gameTitle,
        gameId: r.gameId || '',
        status: r.status || 'PENDING',
        gameAccountUsername: r.gameAccountUsername || '',
        gameAccountPassword: r.gameAccountPassword || '',
        rejectionReason: r.rejectionReason || '',
        createdAt: r.createdAt || new Date(),
        updatedAt: r.updatedAt,
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

    if (!userEmail || !gameTitle) {
      return NextResponse.json(
        { success: false, message: 'Game platform title and user email are required.' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const requestsCol = db.collection('accountRequests');

    // Check if player already has a READY or PENDING request for this game
    const existing = await requestsCol.findOne({
      userEmail,
      gameTitle,
      status: { $in: ['PENDING', 'READY'] },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        message:
          existing.status === 'READY'
            ? 'You already have active credentials for this game platform.'
            : 'Your request for this game is currently pending staff approval.',
        accountRequest: {
          id: existing._id ? existing._id.toString() : existing.id,
          userEmail: existing.userEmail,
          gameTitle: existing.gameTitle,
          status: existing.status,
          gameAccountUsername: existing.gameAccountUsername,
          gameAccountPassword: existing.gameAccountPassword,
        },
      });
    }

    const newRequest = {
      userEmail,
      userName,
      gameTitle,
      gameId,
      status: 'PENDING',
      gameAccountUsername: '',
      gameAccountPassword: '',
      rejectionReason: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await requestsCol.insertOne(newRequest);

    return NextResponse.json({
      success: true,
      message: 'Game account request submitted! Staff will approve and provide your login details shortly.',
      accountRequest: {
        id: res.insertedId ? res.insertedId.toString() : '',
        ...newRequest,
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// PATCH - Staff approves or rejects request
export async function PATCH(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role === ROLES.PLAYER) {
      return NextResponse.json({ success: false, message: 'Unauthorized staff access.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, gameAccountUsername, gameAccountPassword, rejectionReason } = body;

    if (!id || !action) {
      return NextResponse.json({ success: false, message: 'Missing id or action.' }, { status: 400 });
    }

    const db = await getDb();
    const requestsCol = db.collection('accountRequests');

    let filter = { _id: id };
    if (ObjectId.isValid(id)) {
      filter = { _id: new ObjectId(id) };
    }

    const existingReq = await requestsCol.findOne(filter);
    if (!existingReq) {
      return NextResponse.json({ success: false, message: 'Request record not found.' }, { status: 404 });
    }

    if (action === 'APPROVE') {
      const uName = gameAccountUsername?.trim() || `${existingReq.userName}_${Math.floor(100 + Math.random() * 900)}`;
      const uPass = gameAccountPassword?.trim() || `Panda#${Math.floor(1000 + Math.random() * 9000)}`;

      await requestsCol.updateOne(filter, {
        $set: {
          status: 'READY',
          gameAccountUsername: uName,
          gameAccountPassword: uPass,
          updatedAt: new Date(),
        },
      });

      // Save into gameAccounts collection
      const accountsCol = db.collection('gameAccounts');
      await accountsCol.insertOne({
        userEmail: existingReq.userEmail,
        gameTitle: existingReq.gameTitle,
        username: uName,
        password: uPass,
        status: 'READY',
        createdAt: new Date(),
      });

      // Send notification to user
      const notifsCol = db.collection('notifications');
      await notifsCol.insertOne({
        userEmail: existingReq.userEmail,
        title: `Game Credentials Ready: ${existingReq.gameTitle}`,
        message: `Your login for ${existingReq.gameTitle} is ready! Username: ${uName} | Password: ${uPass}`,
        type: 'SUCCESS',
        read: false,
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: 'Account request approved and credentials dispatched to player.',
      });
    } else if (action === 'REJECT') {
      await requestsCol.updateOne(filter, {
        $set: {
          status: 'REJECTED',
          rejectionReason: rejectionReason || 'Request could not be processed at this time.',
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Account request has been rejected.',
      });
    }

    return NextResponse.json({ success: false, message: 'Invalid action.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
