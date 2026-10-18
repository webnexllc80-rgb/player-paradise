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
    const db = await getDb();
    const notifsCol = db.collection('notifications');

    const testItem = {
      title: '⚡ Test Alert: Players Paradise Live!',
      message: 'Test notification delivered successfully to Chrome Desktop & In-App screen! Zero reload required.',
      target: 'all',
      channel: 'all',
      segment: 'all',
      url: '/promotions',
      type: 'broadcast',
      sentBy: 'System Test Desk',
      createdAt: new Date(),
    };

    const result = await notifsCol.insertOne(testItem);

    // Optional FCM push
    sendPushNotification({
      topic: 'vegas_all_players',
      title: testItem.title,
      body: testItem.message,
      data: { url: testItem.url },
    }).catch(() => {});

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
