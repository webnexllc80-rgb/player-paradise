import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/mongodb';

let messagingInstance = null;
let loadedAccountSource = null;

function findServiceAccount() {
  // 1. Check environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      if (parsed.private_key && parsed.client_email) {
        loadedAccountSource = 'process.env.FIREBASE_SERVICE_ACCOUNT';
        return parsed;
      }
    } catch (e) {
      console.warn('[FCM] Error parsing FIREBASE_SERVICE_ACCOUNT env var:', e.message);
    }
  }

  // 2. High-priority candidate filenames (including VPS 0b970 and local 0b978)
  const priorityFiles = [
    'playerparadisehub-firebase-adminsdk-fbsvc-0b970ee61b.json',
    'playerparadisehub-firebase-adminsdk-fbsvc-0b978ee61b.json',
    'firebase-service-account.json',
    'firebase-admin.json',
  ];

  const attemptLogs = [];

  for (const filename of priorityFiles) {
    const fullPath = path.join(/*turbopackIgnore: true*/ process.cwd(), filename);
    const logItem = { file: filename, fullPath };
    try {
      const exists = fs.existsSync(/*turbopackIgnore: true*/ fullPath);
      logItem.exists = exists;
      if (exists) {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ fullPath, 'utf8');
        logItem.byteLength = content.length;
        try {
          const parsed = JSON.parse(content);
          logItem.parsed = true;
          logItem.keys = Object.keys(parsed);
          logItem.projectId = parsed.project_id || null;
          logItem.hasPrivateKey = Boolean(parsed.private_key);
          logItem.hasClientEmail = Boolean(parsed.client_email);
          if (parsed.private_key && parsed.client_email) {
            loadedAccountSource = filename;
            lastInitAttemptLogs = attemptLogs;
            return parsed;
          } else {
            logItem.failure = 'Missing private_key or client_email in parsed JSON';
          }
        } catch (jsonErr) {
          logItem.parsed = false;
          logItem.jsonError = jsonErr.message;
        }
      }
    } catch (fsErr) {
      logItem.fsError = fsErr.message;
    }
    attemptLogs.push(logItem);
  }

  // 3. Dynamic scan of process.cwd() for any adminsdk or firebase json file
  try {
    const files = fs.readdirSync(/*turbopackIgnore: true*/ process.cwd());
    for (const file of files) {
      if (
        file.endsWith('.json') &&
        (file.includes('adminsdk') || file.includes('service-account') || file.includes('firebase')) &&
        !file.includes('package') &&
        !file.includes('tsconfig') &&
        !file.includes('jsconfig')
      ) {
        const fullPath = path.join(/*turbopackIgnore: true*/ process.cwd(), file);
        const logItem = { file, dynamic: true, fullPath };
        try {
          const content = fs.readFileSync(/*turbopackIgnore: true*/ fullPath, 'utf8');
          logItem.byteLength = content.length;
          const parsed = JSON.parse(content);
          logItem.parsed = true;
          logItem.hasPrivateKey = Boolean(parsed.private_key);
          logItem.hasClientEmail = Boolean(parsed.client_email);
          logItem.projectId = parsed.project_id || null;
          if (parsed.private_key && parsed.client_email) {
            loadedAccountSource = file;
            lastInitAttemptLogs = attemptLogs;
            return parsed;
          } else {
            logItem.failure = 'Missing private_key or client_email in dynamic JSON';
          }
        } catch (err) {
          logItem.error = err.message;
        }
        attemptLogs.push(logItem);
      }
    }
  } catch (scanErr) {
    attemptLogs.push({ scanError: scanErr.message });
  }

  lastInitAttemptLogs = attemptLogs;
  return null;
}

let lastInitError = null;
let lastInitAttemptLogs = [];

export function getFcmDiagnostics() {
  let rootFiles = [];
  try {
    rootFiles = fs
      .readdirSync(/*turbopackIgnore: true*/ process.cwd())
      .filter((f) => f.endsWith('.json'));
  } catch {}
  return {
    initialized: Boolean(messagingInstance),
    source: loadedAccountSource,
    lastInitError,
    attemptLogs: lastInitAttemptLogs,
    cwd: process.cwd(),
    jsonFilesInCwd: rootFiles,
    hasEnvServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT),
    envServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || null,
  };
}

export async function getFirebaseMessaging() {
  if (messagingInstance) return messagingInstance;

  try {
    let initializeApp, cert, getApps, getMessaging;
    try {
      ({ initializeApp, cert, getApps } = await import('firebase-admin/app'));
      ({ getMessaging } = await import('firebase-admin/messaging'));
    } catch (impErr) {
      lastInitError = `firebase-admin package not installed (run npm install): ${impErr.message}`;
      console.warn('[FCM]', lastInitError);
      return null;
    }

    let serviceAccount = null;
    const envPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (envPath && fs.existsSync(/*turbopackIgnore: true*/ envPath)) {
      try {
        serviceAccount = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ envPath, 'utf8'));
        loadedAccountSource = envPath;
      } catch (e) {
        lastInitError = `Invalid JSON at FIREBASE_SERVICE_ACCOUNT_PATH: ${e.message}`;
      }
    }
    if (!serviceAccount) serviceAccount = findServiceAccount();

    if (!serviceAccount) {
      lastInitError = lastInitError || `No valid service account JSON (with private_key) found in ${process.cwd()}`;
      console.warn('[FCM]', lastInitError);
      return null;
    }

    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : initializeApp({
      credential: cert(serviceAccount),
    });

    messagingInstance = getMessaging(app);
    lastInitError = null;
    console.log(`[FCM] Successfully initialized Firebase Messaging using: ${loadedAccountSource}`);
    return messagingInstance;
  } catch (err) {
    lastInitError = `Firebase init error: ${err.message}`;
    console.warn('[FCM]', lastInitError);
    return null;
  }
}

// Build Android & WebPush payload for lockscreen & high-priority heads-up delivery
function buildFcmPayload({ title, body, data = {} }) {
  const notifTitle = title || '🎰 LIVE VIP BONUS: 10 SC Drop!';
  const notifBody = body || 'Instant Flash Bonus credited to your account! Tap to play now.';
  const targetUrl = data.url || '/';

  return {
    notification: {
      title: notifTitle,
      body: notifBody,
    },
    data: {
      ...data,
      title: notifTitle,
      body: notifBody,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      url: targetUrl,
    },
    android: {
      priority: 'high',
      ttl: 86400 * 1000,
      notification: {
        channelId: 'default',
        sound: 'default',
        defaultSound: true,
        defaultVibrateTimings: true,
        priority: 'max', // MAX priority ensures heads-up banner & lockscreen popup
        visibility: 'public', // 'public' shows full banner on Android lock screen
        icon: 'ic_launcher',
        color: '#00F0FF',
        tag: 'players-paradise-alert',
        clickAction: 'FLUTTER_NOTIFICATION_CLICK',
      },
    },
    webpush: {
      headers: {
        Urgency: 'high',
      },
      notification: {
        title: notifTitle,
        body: notifBody,
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
    return { success: false, simulated: true, error: lastInitError, diagnostics: getFcmDiagnostics() };
  }

  const payload = buildFcmPayload({ title, body, data });

  // 1. Send to single device token if specified
  if (token) {
    try {
      const res = await messaging.send({ ...payload, token });
      return { success: true, messageId: res };
    } catch (err) {
      console.warn('[FCM] Send to token error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // 2. Multicast to ALL active device tokens registered in subscriptions
  let multicastCount = 0;
  let allTokens = [];
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

    allTokens = [
      ...new Set(
        subs
          .map((s) => s.fcmToken || s.token)
          .filter((t) => typeof t === 'string' && t.trim().length > 15)
      ),
    ];

    if (allTokens.length > 0) {
      // Chunk tokens in batches of 500 for FCM sendEachForMulticast
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
          console.warn('[FCM] Multicast batch error:', mErr.message);
        }
      }

      // Also ensure all tokens are subscribed to topics for future pushes
      try {
        await messaging.subscribeToTopic(allTokens, 'paradise_all_players');
        await messaging.subscribeToTopic(allTokens, 'all_players');
        await messaging.subscribeToTopic(allTokens, 'vegas_all_players');
      } catch {}
    }
  } catch (dbErr) {
    console.warn('[FCM] Subscription token lookup notice:', dbErr.message);
  }

  // 3. Also send to topics as guaranteed broadcast
  const topicsToSend = [
    topic || 'paradise_all_players',
    'paradise_all_players',
    'all_players',
    'vegas_all_players',
  ];
  const uniqueTopics = [...new Set(topicsToSend.filter(Boolean))];
  const topicResults = [];

  for (const t of uniqueTopics) {
    try {
      const topicRes = await messaging.send({
        ...payload,
        topic: t,
      });
      topicResults.push({ topic: t, success: true, messageId: topicRes });
    } catch (tErr) {
      topicResults.push({ topic: t, success: false, error: tErr.message });
    }
  }

  const anyTopicSuccess = topicResults.some((r) => r.success);
  console.log(`[FCM BROADCAST] Multicast delivered: ${multicastCount} devices | Topics: ${JSON.stringify(topicResults)}`);

  return {
    success: multicastCount > 0 || anyTopicSuccess,
    multicastCount,
    totalTokens: allTokens.length,
    topicResults,
    source: loadedAccountSource,
  };
}
