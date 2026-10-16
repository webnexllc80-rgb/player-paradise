import fs from 'fs';
import path from 'path';

let messagingInstance = null;

async function getFirebaseMessaging() {
  if (messagingInstance) return messagingInstance;

  try {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getMessaging } = await import('firebase-admin/messaging');

    const possiblePaths = [
      path.join(process.cwd(), 'playerparadisehub-firebase-adminsdk-fbsvc-0b978ee61b.json'),
      path.join(process.cwd(), 'firebase-service-account.json'),
      path.join(process.cwd(), 'firebase-admin.json'),
      path.join(process.cwd(), 'google-services.json'),
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

export async function sendPushNotification({ token, topic, title, body, data = {} }) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    console.log(`[FCM SIMULATED PUSH] Title: "${title}" | Body: "${body}" | Target: ${token || topic}`);
    return { success: true, simulated: true };
  }

  try {
    const message = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    };

    if (token) {
      message.token = token;
      const res = await messaging.send(message);
      return { success: true, messageId: res };
    } else if (topic) {
      message.topic = topic;
      const res = await messaging.send(message);
      return { success: true, messageId: res };
    }

    return { success: false, error: 'No target token or topic provided' };
  } catch (error) {
    console.error('FCM Send error:', error);
    return { success: false, error: error.message };
  }
}
