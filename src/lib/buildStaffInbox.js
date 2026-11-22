/**
 * Group chat messages into staff inbox conversation summaries (lightweight).
 */
export async function buildStaffInbox(chatCol) {
  try {
    const rawMessages = await chatCol
      .find(
        {},
        {
          projection: {
            conversationId: 1,
            userId: 1,
            username: 1,
            customerUsername: 1,
            customerUserId: 1,
            senderRole: 1,
            read: 1,
            text: 1,
            createdAt: 1,
            hasImage: { $cond: [{ $ifNull: ['$imageUrl', false] }, true, false] },
          },
        }
      )
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();

    const convMap = new Map();

    for (const msg of rawMessages) {
      const cid = String(msg.conversationId || msg.userId || '').trim();
      if (!cid) continue;

      const customerName =
        msg.customerUsername || (msg.senderRole === 'player' ? msg.username : null);
      const customerUid =
        msg.customerUserId || (msg.senderRole === 'player' ? msg.userId : null);

      const isUnreadPlayerMsg = msg.read === false && msg.senderRole === 'player';

      if (!convMap.has(cid)) {
        convMap.set(cid, {
          _id: cid,
          userId: customerUid || msg.userId || cid,
          username: customerName || msg.username || 'Player',
          lastMessage:
            msg.text || (msg.hasImage || msg.imageUrl ? '📷 [Image Attachment]' : 'Active inquiry'),
          lastSenderRole: msg.senderRole || 'player',
          updatedAt: msg.createdAt || new Date(),
          unreadCount: isUnreadPlayerMsg ? 1 : 0,
          unreadStaff: isUnreadPlayerMsg,
        });
      } else {
        const conv = convMap.get(cid);
        if (
          customerName &&
          (conv.username === 'Player' || conv.username === 'Players Paradise Support')
        ) {
          conv.username = customerName;
        }
        if (customerUid && conv.userId === cid) {
          conv.userId = customerUid;
        }
        if (isUnreadPlayerMsg) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
          conv.unreadStaff = true;
        }
      }
    }

    return Array.from(convMap.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (err) {
    console.error('buildStaffInbox error:', err);
    return [];
  }
}