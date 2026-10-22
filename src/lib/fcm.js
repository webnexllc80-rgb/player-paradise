import fs from 'fs';
import path from 'path';
import { getDb } from '@/lib/mongodb';
import { FALLBACK_FIREBASE_SERVICE_ACCOUNT } from './firebaseCredentials';

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

  // 4. Guaranteed embedded fallback credentials (tracked by git, works 100% on VPS)
  if (FALLBACK_FIREBASE_SERVICE_ACCOUNT?.private_key && FALLBACK_FIREBASE_SERVICE_ACCOUNT?.client_email) {
    loadedAccountSource = 'embedded:firebaseCredentials.js';
    lastInitAttemptLogs = attemptLogs;
    return FALLBACK_FIREBASE_SERVICE_ACCOUNT;
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

    if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
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

/**
 * Send push notification targeting:
 * 1. Single device: { token: '...' }
 * 2. Specific device list: { tokens: ['...'] }
 * 3. Specific topic ONLY: { topic: 'paradise_staff_alerts' } (DOES NOT broadcast to players!)
 * 4. Explicit broadcast: { broadcast: true, topic: 'paradise_all_players' }
 */
export async function sendPushNotification({
  token,
  tokens,
  topic,
  broadcast = false,
  title,
  body,
  data = {},
}) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    console.log(`[FCM SIMULATED PUSH] Title: "${title}" | Body: "${body}"`);
    return { success: false, simulated: true, error: lastInitError, diagnostics: getFcmDiagnostics() };
  }

  const payload = buildFcmPayload({ title, body, data });

  // 1. Send to single device token if specified (STRICTLY single device!)
  if (token && typeof token === 'string' && token.trim().length > 15) {
    try {
      const res = await messaging.send({ ...payload, token: token.trim() });
      return { success: true, messageId: res };
    } catch (err) {
      console.warn('[FCM] Send to token error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // 2. Send to multiple specific tokens if provided (STRICTLY specified devices!)
  if (Array.isArray(tokens) && tokens.length > 0) {
    const validTokens = [...new Set(tokens.filter((t) => typeof t === 'string' && t.trim().length > 15))];
    if (validTokens.length > 0) {
      let sentCount = 0;
      const batchSize = 500;
      for (let i = 0; i < validTokens.length; i += batchSize) {
        const batch = validTokens.slice(i, i + batchSize);
        try {
          const multiRes = await messaging.sendEachForMulticast({ tokens: batch, ...payload });
          sentCount += multiRes.successCount;
        } catch (mErr) {
          console.warn('[FCM] Multicast specific tokens batch error:', mErr.message);
        }
      }
      return { success: sentCount > 0, deliveredCount: sentCount, totalTokens: validTokens.length };
    }
    return { success: false, error: 'No valid tokens in list' };
  }

  // 3. Send to a SPECIFIC topic ONLY (Never add all_players topics and NEVER multicast!)
  if (topic && !broadcast) {
    try {
      const topicRes = await messaging.send({ ...payload, topic });
      console.log(`[FCM TOPIC] Sent to topic [${topic}]:`, topicRes);
      return { success: true, messageId: topicRes, topic };
    } catch (tErr) {
      console.warn(`[FCM] Topic [${topic}] send error:`, tErr.message);
      return { success: false, error: tErr.message, topic };
    }
  }

  // 4. EXPLICIT BROADCAST ONLY (Admin promotional announcement to all players)
  if (broadcast) {
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
            console.warn('[FCM] Broadcast multicast batch error:', mErr.message);
          }
        }
      }
    } catch (dbErr) {
      console.warn('[FCM] Broadcast token lookup notice:', dbErr.message);
    }

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
        const topicRes = await messaging.send({ ...payload, topic: t });
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

  // If none of the conditions matched, return error (DO NOT SILENTLY BROADCAST!)
  return { success: false, error: 'Recipient token, tokens list, topic, or broadcast flag required.' };
}
