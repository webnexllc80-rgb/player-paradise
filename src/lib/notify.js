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

      // 1. In-app notification record
      await db.collection('notifications').insertOne({
        userId: cleanUid,
        userEmail: cleanEmail,
        username: username || cleanEmail.split('@')[0] || 'Player',
        title,
        message,
        type,
        url: data?.url || (type === 'chat_message' ? '/chat' : '/'),
        read: false,
        createdAt: new Date(),
      }).catch(() => {});

      // 2. Find FCM device push token
      let token = null;
      if (cleanEmail) {
        const sub = await db.collection('subscriptions').findOne({ email: cleanEmail });
        if (sub) token = sub.fcmToken || sub.token;
      }
      if (!token && cleanUid) {
        const sub = await db.collection('subscriptions').findOne({ userId: cleanUid });
        if (sub) token = sub.fcmToken || sub.token;
      }

      // 3. Send Push Notification via Firebase
      await sendPushNotification({
        token,
        topic: token ? undefined : 'paradise_all_players',
        title,
        body: message,
        data: { ...data, type },
      }).catch((e) => {
        console.warn('[Notify Push Delivery Note]:', e.message);
      });
    } catch (err) {
      console.warn('[Notify Helper Error]:', err.message);
    }
  })();
}
