import { NextResponse } from 'next/server';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// GET: Fetch chat messages
export async function GET(req) {
  try {
    const session = await getSessionUser();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const guestId = searchParams.get('guestId');
    const inbox = searchParams.get('inbox') === 'true';

    // Must be either authenticated or have a persistent guestId
    if (!session && !guestId) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please provide a guest session or login.' }, { status: 401 });
    }

    const db = await getDb();
    const chatCol = db.collection('chat_messages');

    const isStaff =
      session &&
      (session.role === ROLES.SUPER_ADMIN ||
        session.role === ROLES.CHAT_SUPPORT ||
        session.role === ROLES.OPERATION_ADMIN);

    // Staff Inbox list of conversations
    if (isStaff && inbox) {
      const activeConvs = await chatCol.aggregate([
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$conversationId',
            username: { $first: '$username' },
            userId: { $first: '$userId' },
            lastMessage: { $first: '$text' },
            lastSenderRole: { $first: '$senderRole' },
            updatedAt: { $first: '$createdAt' },
            unreadCount: {
              $sum: {
                $cond: [{ $and: [{ $eq: ['$read', false] }, { $eq: ['$senderRole', 'player'] }] }, 1, 0],
              },
            },
          },
        },
        { $sort: { updatedAt: -1 } },
        { $limit: 50 },
      ]).toArray();

      return NextResponse.json({ success: true, conversations: activeConvs });
    }

    // Messages within a conversation:
    // Staff can view any conversationId.
    // Logged in user views their own session.userId.
    // Unauthenticated guest views their guestId.
    const targetConvId = isStaff && conversationId ? conversationId : session ? session.userId : guestId;

    const messages = await chatCol
      .find({ conversationId: targetConvId })
      .sort({ createdAt: 1 })
      .limit(100)
      .toArray();

    // Mark messages read by staff or player
    if (isStaff) {
      await chatCol.updateMany(
        { conversationId: targetConvId, senderRole: 'player', read: false },
        { $set: { read: true } }
      );
    }

    return NextResponse.json({
      success: true,
      messages: messages.map(m => ({
        id: m._id ? m._id.toString() : m.id,
        conversationId: m.conversationId,
        userId: m.userId,
        username: m.username,
        senderRole: m.senderRole,
        text: m.text || '',
        imageUrl: m.imageUrl || null,
        read: m.read,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Send Chat Message (Append-Only)
export async function POST(req) {
  try {
    const session = await getSessionUser();
    const body = await req.json();
    const { text, imageUrl, conversationId, targetUsername, targetUserId, guestId, guestName } = body;

    if (!session && !guestId) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please provide a guest session or login.' }, { status: 401 });
    }

    if ((!text || !text.trim()) && !imageUrl) {
      return NextResponse.json({ success: false, error: 'Message text or image attachment required.' }, { status: 400 });
    }

    const isStaff =
      session &&
      (session.role === ROLES.SUPER_ADMIN ||
        session.role === ROLES.CHAT_SUPPORT ||
        session.role === ROLES.OPERATION_ADMIN);

    let resolvedConvId;
    let senderUserId;
    let senderUsername;
    let senderRole = 'player';
    let staffName = null;

    if (isStaff) {
      resolvedConvId = conversationId;
      senderUserId = targetUserId || resolvedConvId;
      senderUsername = targetUsername || 'Players Paradise Support';
      senderRole = 'staff';
      staffName = session.username;
    } else if (session) {
      resolvedConvId = session.userId;
      senderUserId = session.userId;
      senderUsername = session.username;
      senderRole = 'player';
    } else {
      // Unauthenticated Guest
      const cleanGuestId = String(guestId).trim();
      resolvedConvId = cleanGuestId;
      senderUserId = cleanGuestId;
      const cleanSuffix = cleanGuestId.replace('guest_', '').slice(-4).toUpperCase();
      senderUsername = guestName?.trim() || `Guest #${cleanSuffix}`;
      senderRole = 'player';
    }

    const db = await getDb();
    const chatCol = db.collection('chat_messages');

    const newMsg = {
      conversationId: resolvedConvId,
      userId: senderUserId,
      username: senderUsername,
      senderRole,
      staffName,
      text: (text || '').trim(),
      imageUrl: imageUrl || null,
      read: false,
      isGuest: !session,
      createdAt: new Date(),
    };

    const res = await chatCol.insertOne(newMsg);

    return NextResponse.json({
      success: true,
      message: {
        id: res.insertedId ? res.insertedId.toString() : Math.random().toString(36).substring(2, 10),
        ...newMsg,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// NOTE: Compliance policy: DELETE method is strictly disabled.
export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Compliance Violation: Deletion of chat records is strictly disabled.' },
    { status: 405 }
  );
}
