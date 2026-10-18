import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/mongodb';

let messagingInstance = null;

export async function getFirebaseMessaging() {
  if (messagingInstance) return messagingInstance;

  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    const possiblePaths = [
      path.join(process.cwd(), 'firebase-service-account.json'),
      path.join(process.cwd(), 'playerparadisehub-firebase-adminsdk-fbsvc-0b978ee61b.json'),
      path.join(process.cwd(), 'firebase-admin.json'),
      path.join(process.cwd(), 'google-services.json'),
      path.join(process.cwd(), 'android/app/google-services.json'),
    ];

    let serviceAccount = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch {}
    }

    if (!serviceAccount) {
      for (const p of possiblePaths) {
        if (fs.existsSync(/*turbopackIgnore: true*/ p)) {
          try {
            serviceAccount = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ p, 'utf8'));
            break;
          } catch {}
        }
      }
    }

    if (!serviceAccount) {
      console.warn('Firebase Service Account credentials not found in paths.');
      return null;
    }

    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : initializeApp({
      credential: cert(serviceAccount),
    });

    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.warn('Firebase Messaging init error:', err.message);
    return null;
  }
}

// Build Android & WebPush payload for lockscreen & high-priority delivery
function buildFcmPayload({ title, body, data = {} }) {
  return {
    notification: {
      title: title || '🎰 VIP Flash Coin Drop Activated!',
      body: body || '5.00 SC + 50,000 GC test bonus has been credited to your player account. Enjoy the games!',
    },
    data: {
      ...data,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      url: data.url || '/',
    },
    android: {
      priority: 'high',
      ttl: 86400 * 1000,
      notification: {
        channelId: 'default',
        sound: 'default',
        defaultSound: true,
        defaultVibrateTimings: true,
        priority: 'high',
        visibility: 'public', // Shows on lock screen
        icon: 'ic_launcher',
        color: '#00F0FF',
        tag: 'players-paradise-alert',
      },
    },
    webpush: {
      headers: {
        Urgency: 'high',
      },
      notification: {
        title: title || '🎰 VIP Flash Coin Drop Activated!',
        body: body || '5.00 SC + 50,000 GC test bonus has been credited to your player account. Enjoy the games!',
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [300, 100, 300],
        requireInteraction: true,
      },
    },
  };
}

// Send to specific token, topic, OR broadcast to all devices in database
export async function sendPushNotification({ token, topic, title, body, data = {} }) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    console.log(`[FCM SIMULATED PUSH] Title: "${title}" | Body: "${body}"`);
    return { success: true, simulated: true };
  }

  const payload = buildFcmPayload({ title, body, data });

  // 1. Send to single device token if specified
  if (token) {
    try {
      const res = await messaging.send({ ...payload, token });
      return { success: true, messageId: res };
    } catch (err) {
      console.warn('FCM send to token error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // 2. Multicast to ALL active device tokens registered in subscriptions
  let multicastCount = 0;
  try {
    const db = await getDb();
    const subs = await db
      .collection('subscriptions')
      .find({
        $or: [
          { fcmToken: { $exists: true, $ne: null } },
          { token: { $exists: true, $ne: null } },
        ],
      })
      .toArray();

    const allTokens = [
      ...new Set(
        subs
          .map((s) => s.fcmToken || s.token)
          .filter((t) => typeof t === 'string' && t.length > 15)
      ),
    ];

    if (allTokens.length > 0) {
      // Chunk tokens in batches of 500 for FCM multicast
      const batchSize = 500;
      for (let i = 0; i < allTokens.length; i += batchSize) {
        const tokenBatch = allTokens.slice(i, i + batchSize);
        try {
          const multiRes = await messaging.sendEachForMulticast({
            tokens: tokenBatch,
            ...payload,
          });
          multicastCount += multiRes.successCount;
        } catch (mErr) {
          console.warn('FCM multicast batch error:', mErr.message);
        }
      }

      // Also ensure all tokens are subscribed to topics for future pushes
      try {
        await messaging.subscribeToTopic(allTokens, 'paradise_all_players');
        await messaging.subscribeToTopic(allTokens, 'vegas_all_players');
      } catch {}
    }
  } catch (dbErr) {
    console.warn('FCM subscription token lookup notice:', dbErr.message);
  }

  // 3. Also send to topic as backup
  const targetTopic = topic || 'paradise_all_players';
  try {
    const topicRes = await messaging.send({
      ...payload,
      topic: targetTopic,
    });
    return { success: true, topicMessageId: topicRes, multicastCount };
  } catch (topicErr) {
    if (multicastCount > 0) {
      return { success: true, multicastCount };
    }
    return { success: false, error: topicErr.message };
  }
}
