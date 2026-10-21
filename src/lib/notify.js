import { getDb } from './mongodb';
import { sendPushNotification } from './fcm';

/**
 * Dispatches an instant in-app notification & push notification without blocking caller.
 */
export function notifyPlayer({ userId, userEmail, username, title, message, type = 'general', data = {} }) {
  // Fire asynchronously in background
  (async () => {
    try {
      const db = await getDb();
      if (!db || !db.collection) return;

      const cleanEmail = (userEmail || '').toLowerCase().trim();
      const cleanUid = userId ? userId.toString() : null;

      // 1. In-app notification record for targeted player
      await db.collection('notifications').insertOne({
        userId: cleanUid,
        userEmail: cleanEmail,
        target: 'player',
        username: username || cleanEmail.split('@')[0] || 'Player',
        title,
        message,
        type,
        url: data?.url || (type === 'chat_message' ? '/chat' : '/'),
        read: false,
        createdAt: new Date(),
      }).catch(() => {});

      // 2. Find FCM device push tokens specifically for this player
      const tokenQueries = [];
      if (cleanEmail) tokenQueries.push({ email: cleanEmail });
      if (cleanUid) tokenQueries.push({ userId: cleanUid });

      if (tokenQueries.length > 0) {
        const subs = await db.collection('subscriptions').find({ $or: tokenQueries }).toArray();
        const userTokens = [...new Set(subs.map(s => s.fcmToken || s.token).filter(Boolean))];

        // 3. Send Push Notification to player's devices ONLY (Never broadcast personal alerts to all players!)
        for (const tok of userTokens) {
          await sendPushNotification({
            token: tok,
            title,
            body: message,
            data: { ...data, type, target: 'player', userId: cleanUid || '' },
          }).catch((e) => {
            console.warn('[Notify User Push Note]:', e.message);
          });
        }
      }
    } catch (err) {
      console.warn('[Notify Helper Error]:', err.message);
    }
  })();
}
