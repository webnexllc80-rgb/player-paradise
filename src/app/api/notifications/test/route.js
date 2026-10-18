import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { sendPushNotification } from '@/lib/fcm';

export async function GET(req) {
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

    // FCM Push for Mobile Devices & APK
    Promise.allSettled([
      sendPushNotification({
        topic: 'vegas_all_players',
        title,
        body: message,
        data: { url: targetUrl },
      }),
      sendPushNotification({
        topic: 'paradise_all_players',
        title,
        body: message,
        data: { url: targetUrl },
      }),
    ]).catch(() => {});

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
