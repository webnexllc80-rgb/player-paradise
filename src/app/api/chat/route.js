import { NextResponse } from 'next/server';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// GET: Fetch chat messages
export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');
    const inbox = searchParams.get('inbox') === 'true';

    const db = await getDb();
    const chatCol = db.collection('chat_messages');

    const isStaff =
      session.role === ROLES.SUPER_ADMIN ||
      session.role === ROLES.CHAT_SUPPORT ||
      session.role === ROLES.OPERATION_ADMIN;

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

    // Messages within a conversation
    const targetConvId = isStaff && conversationId ? conversationId : session.userId;

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
        id: m._id.toString(),
        conversationId: m.conversationId,
        userId: m.userId,
        username: m.username,
        senderRole: m.senderRole,
        text: m.text,
        read: m.read,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Send Chat Message (Append-Only. No Chat Delete is permitted!)
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { text, conversationId, targetUsername, targetUserId } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: 'Message cannot be empty.' }, { status: 400 });
    }

    const isStaff =
      session.role === ROLES.SUPER_ADMIN ||
      session.role === ROLES.CHAT_SUPPORT ||
      session.role === ROLES.OPERATION_ADMIN;
    const resolvedConvId = isStaff && conversationId ? conversationId : session.userId;

    const db = await getDb();
    const chatCol = db.collection('chat_messages');

    const newMsg = {
      conversationId: resolvedConvId,
      userId: isStaff ? (targetUserId || resolvedConvId) : session.userId,
      username: isStaff ? (targetUsername || 'Vegas One Support') : session.username,
      senderRole: isStaff ? 'staff' : 'player',
      staffName: isStaff ? session.username : null,
      text: text.trim(),
      read: false,
      createdAt: new Date(),
    };

    const res = await chatCol.insertOne(newMsg);

    return NextResponse.json({
      success: true,
      message: {
        id: res.insertedId.toString(),
        ...newMsg,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// NOTE: Strict compliance policy: DELETE method is intentionally NOT implemented!
export async function DELETE() {
  return NextResponse.json(
    { success: false, error: 'Compliance Violation: Deletion of chat records is strictly disabled for Vegas One.' },
    { status: 405 }
  );
}
