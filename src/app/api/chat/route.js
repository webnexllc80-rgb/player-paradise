import { NextResponse } from 'next/server';
import { getSessionUser, ROLES, safeIdFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { notifyPlayer } from '@/lib/notify';
import { sendPushNotification } from '@/lib/fcm';

// GET: Fetch chat messages or staff inbox conversations
export async function GET(req) {
  try {
    const session = await getSessionUser();
    const { searchParams } = new URL(req.url);
    const conversationId = (searchParams.get('conversationId') || '').trim();
    const guestId = (searchParams.get('guestId') || '').trim();
    const inbox = searchParams.get('inbox') === 'true';

    // Must be either authenticated or have a guestId
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
            username: { $first: { $ifNull: ['$customerUsername', '$username'] } },
            userId: { $first: { $ifNull: ['$customerUserId', '$userId'] } },
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
        { $limit: 100 },
      ]).toArray();

      // Clean up conversations without valid IDs
      const cleanedConvs = (activeConvs || []).filter((c) => c && c._id);
      return NextResponse.json({ success: true, conversations: cleanedConvs });
    }

    // Resolve target conversation ID
    let targetConvId = null;
    if (isStaff && conversationId) {
      targetConvId = conversationId;
    } else if (session) {
      targetConvId = session.userId;
    } else if (guestId) {
      targetConvId = guestId;
    }

    if (!targetConvId) {
      return NextResponse.json({ success: true, messages: [], unreadCount: 0 });
    }

    // Query messages matching conversationId or legacy userId
    const messages = await chatCol
      .find({
        $or: [
          { conversationId: targetConvId },
          { userId: targetConvId },
        ],
      })
      .sort({ createdAt: 1 })
      .limit(150)
      .toArray();

    // Mark messages as read
    if (isStaff) {
      // Staff reading player messages
      await chatCol.updateMany(
        {
          $or: [{ conversationId: targetConvId }, { userId: targetConvId }],
          senderRole: 'player',
          read: false,
        },
        { $set: { read: true } }
      );
    } else {
      // Player/Guest reading staff messages
      await chatCol.updateMany(
        {
          $or: [{ conversationId: targetConvId }, { userId: targetConvId }],
          senderRole: 'staff',
          read: false,
        },
        { $set: { read: true } }
      );
    }

    // Unread count from staff for player
    const unreadStaffCount = isStaff
      ? 0
      : messages.filter((m) => m.senderRole === 'staff' && !m.read).length;

    return NextResponse.json({
      success: true,
      unreadCount: unreadStaffCount,
      messages: messages.map((m) => ({
        id: m._id ? m._id.toString() : m.id || Math.random().toString(36).substring(2, 10),
        conversationId: m.conversationId || targetConvId,
        userId: m.userId,
        username: m.username,
        senderRole: m.senderRole || 'player',
        staffName: m.staffName || null,
        text: m.text || '',
        imageUrl: m.imageUrl || null,
        read: !!m.read,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/chat error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Send Chat Message (Append-Only)
export async function POST(req) {
  try {
    const session = await getSessionUser();
    const body = await req.json();
    const { text, imageUrl, conversationId, targetUsername, targetUserId, guestId, guestName } = body;

    // Check auth or guest identifier
    if (!session && !guestId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Please provide a guest session or login.' },
        { status: 401 }
      );
    }

    if ((!text || !text.trim()) && !imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Message text or image attachment required.' },
        { status: 400 }
      );
    }

    const isStaff =
      session &&
      (session.role === ROLES.SUPER_ADMIN ||
        session.role === ROLES.CHAT_SUPPORT ||
        session.role === ROLES.OPERATION_ADMIN);

    let resolvedConvId;
    let customerUserId;
    let customerUsername;
    let senderUserId;
    let senderUsername;
    let senderRole = 'player';
    let staffName = null;

    if (isStaff && (conversationId || targetUserId)) {
      // Staff replying from Admin Support Concierge
      resolvedConvId = String(conversationId || targetUserId).trim();
      customerUserId = String(targetUserId || resolvedConvId).trim();
      customerUsername = (targetUsername || 'Player').trim();
      senderRole = 'staff';
      senderUserId = session.userId;
      senderUsername = 'Players Paradise Support';
      staffName = session.username;
    } else if (session) {
      // Logged-in user (player or staff testing from frontend widget)
      resolvedConvId = session.userId;
      customerUserId = session.userId;
      customerUsername = session.username;
      senderRole = isStaff ? 'staff' : 'player';
      senderUserId = session.userId;
      senderUsername = session.username;
      staffName = isStaff ? session.username : null;
    } else {
      // Unauthenticated Guest Visitor
      const cleanGuestId = String(guestId).trim();
      resolvedConvId = cleanGuestId;
      customerUserId = cleanGuestId;
      const cleanSuffix = cleanGuestId.replace('guest_', '').slice(-4).toUpperCase();
      customerUsername = guestName?.trim() || `Guest #${cleanSuffix}`;
      senderRole = 'player';
      senderUserId = cleanGuestId;
      senderUsername = customerUsername;
    }

    const db = await getDb();
    const chatCol = db.collection('chat_messages');

    const newMsg = {
      conversationId: resolvedConvId,
      customerUserId,
      customerUsername,
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

    // Bi-directional Notifications Dispatch
    if (isStaff && (conversationId || targetUserId)) {
      // Staff sent message to Player: Notify player via in-app & push
      (async () => {
        try {
          const targetPlayer = await db
            .collection('users')
            .findOne(safeIdFilter(resolvedConvId, ['username', 'email']));

          if (targetPlayer) {
            notifyPlayer({
              userId: targetPlayer._id ? targetPlayer._id.toString() : resolvedConvId,
              userEmail: targetPlayer.email || null,
              username: targetPlayer.username || customerUsername || 'Player',
              title: `💬 Support Message: ${staffName || 'VIP Concierge'}`,
              message: (text || 'Sent an attachment').slice(0, 100),
              type: 'chat_message',
              data: { url: '/chat', conversationId: resolvedConvId },
            });
          }
        } catch (nErr) {
          console.warn('Chat player notification note:', nErr.message);
        }
      })();
    } else {
      // Player or Guest sent message to Staff: Notify staff dashboard
      (async () => {
        try {
          await db.collection('notifications').insertOne({
            target: 'staff',
            channel: 'all',
            title: `💬 Support Message: ${senderUsername}`,
            message: (text || 'Sent an image attachment').slice(0, 100),
            type: 'chat_message',
            conversationId: resolvedConvId,
            url: `/admin?tab=chat&cid=${resolvedConvId}`,
            read: false,
            createdAt: new Date(),
          });

          await sendPushNotification({
            topic: 'paradise_staff_alerts',
            title: `💬 Support Chat: ${senderUsername}`,
            body: (text || 'Sent an attachment').slice(0, 100),
            data: { url: `/admin?tab=chat&cid=${resolvedConvId}`, conversationId: resolvedConvId },
          });
        } catch (sErr) {
          console.warn('Chat staff notification note:', sErr.message);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      message: {
        id: res.insertedId ? res.insertedId.toString() : Math.random().toString(36).substring(2, 10),
        ...newMsg,
      },
    });
  } catch (error) {
    console.error('POST /api/chat error:', error);
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
