import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendPushNotification } from '@/lib/fcm';

export async function GET(req) {
  const acceptHeader = req.headers.get('accept') || '';
  const { searchParams } = new URL(req.url);

  // If requested by browser directly as HTML
  if (acceptHeader.includes('text/html') && !searchParams.has('json')) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notification Test Station | Players Paradise Hub</title>
  <link rel="icon" href="/logo.png">
  <style>
    body {
      margin: 0;
      padding: 24px;
      background: #060913;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 90vh;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      max-width: 440px;
      width: 100%;
      background: #0d1326;
      border: 1px solid rgba(0, 240, 255, 0.35);
      border-radius: 24px;
      padding: 32px 24px;
      box-shadow: 0 10px 40px rgba(0, 240, 255, 0.2);
    }
    .logo {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      margin-bottom: 16px;
      border: 1px solid #00f0ff;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 8px 0;
      color: #ffffff;
      letter-spacing: 0.5px;
    }
    p {
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      background: linear-gradient(135deg, #00f0ff, #00b4d8);
      color: #000000;
      font-size: 14px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      border: none;
      cursor: pointer;
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.5);
      transition: transform 0.1s ease;
    }
    .btn:active {
      transform: scale(0.98);
    }
    .status {
      margin-top: 18px;
      font-size: 12px;
      color: #10b981;
      min-height: 20px;
      font-weight: bold;
    }
    .back {
      margin-top: 24px;
      display: inline-block;
      color: #00f0ff;
      font-size: 13px;
      text-decoration: none;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="/logo.png" alt="Logo" class="logo" />
    <h1>🎰 Mobile Push & Chrome Test</h1>
    <p>Apne phone ke notification bar aur lockscreen par instant test notification dekhne ke liye neeche button dabayein.</p>

    <button id="testBtn" class="btn" onclick="fireNotification()">
      ⚡ Fire Test Push Notification
    </button>

    <div id="statusBox" class="status">Ready</div>

    <a href="/" class="back">← Back to Players Paradise</a>
  </div>

  <script>
    async function fireNotification() {
      const status = document.getElementById('statusBox');
      status.style.color = '#00f0ff';
      status.innerText = 'Requesting permission & triggering alert...';

      try {
        // 1. Request permission
        if ('Notification' in window) {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            status.style.color = '#ef4444';
            status.innerText = '⚠️ Notification permission denied. Please allow notifications in Chrome settings.';
            return;
          }
        }

        // 2. Trigger native Android Chrome service worker notification
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;

          if (reg && reg.showNotification) {
            await reg.showNotification('🎰 VIP Flash Coin Drop Activated!', {
              body: '5.00 SC + 50,000 GC test bonus has been credited to your player account. Enjoy the games!',
              icon: '/logo.png',
              badge: '/logo.png',
              vibrate: [300, 100, 300],
              tag: 'pp-alert-' + Date.now(),
              renotify: true,
              requireInteraction: true,
              data: { url: '/deposit' },
              actions: [
                { action: 'open', title: 'Claim / View' },
                { action: 'dismiss', title: 'Dismiss' }
              ]
            });
          }
        }

        // 3. Dispatch to server database & FCM
        await fetch('/api/notifications/test?json=true', { method: 'POST' });

        status.style.color = '#10b981';
        status.innerText = '✓ Success! Check your phone notification drawer now.';
      } catch (err) {
        status.style.color = '#ef4444';
        status.innerText = 'Error: ' + err.message;
      }
    }

    // Auto-fire on page load after short delay
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          fireNotification();
        }
      }, 500);
    });
  </script>
</body>
</html>`;
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return handleTestNotification(req);
}

export async function POST(req) {
  return handleTestNotification(req);
}

async function handleTestNotification(req) {
  try {
    let bodyData = {};
    try {
      bodyData = await req.json();
    } catch {}

    const { searchParams } = new URL(req.url);

    const title =
      bodyData.title ||
      searchParams.get('title') ||
      '🎰 VIP Flash Coin Drop Activated!';
    const message =
      bodyData.message ||
      searchParams.get('message') ||
      '5.00 SC + 50,000 GC test bonus has been credited to your player account. Enjoy the games!';
    const targetUrl = bodyData.url || searchParams.get('url') || '/promotions';

    const db = await getDb();
    const notifsCol = db.collection('notifications');

    const testItem = {
      title,
      message,
      target: 'all',
      channel: 'all',
      segment: 'all',
      url: targetUrl,
      type: 'broadcast',
      sentBy: 'System Test Desk',
      createdAt: new Date(),
    };

    const result = await notifsCol.insertOne(testItem);

    // Multicast FCM push to all registered devices & topics
    await sendPushNotification({
      title,
      body: message,
      data: { url: targetUrl },
    }).catch((err) => {
      console.warn('FCM broadcast notice:', err.message);
    });

    return NextResponse.json({
      success: true,
      message: 'Test notification created and broadcasted.',
      id: result.insertedId.toString(),
      notification: testItem,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
