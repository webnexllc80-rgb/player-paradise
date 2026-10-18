import { NextResponse } from 'next/server';
import { getSessionUser, ROLES, getUserFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { sendPushNotification } from '@/lib/fcm';

// GET: Fetch in-app notifications for player OR broadcast history for admin
export async function GET(req) {
  try {
    const session = await getSessionUser();
    const { searchParams } = new URL(req.url);
    const isAdmin = searchParams.get('admin') === 'true';

    const db = await getDb();
    const notifsCol = db.collection('notifications');

    // Admin view: list recent broadcasts
    if (isAdmin) {
      if (!session || session.role === 'player') {
        return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 403 });
      }

      const items = await notifsCol
        .find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();

      return NextResponse.json({
        success: true,
        broadcasts: items.map(n => ({
          id: n._id.toString(),
          title: n.title,
          message: n.message,
          channel: n.channel || 'all',
          segment: n.segment || 'all',
          target: n.target || 'all',
          url: n.url || '/',
          sentBy: n.sentBy || 'Admin',
          createdAt: n.createdAt,
        })),
      });
    }

    // Player view: notifications broadcast to all, or targeted to user by id, username, or email
    const emailParam = searchParams.get('email');
    const targetConditions = [{ target: 'all' }];

    if (session?.userId) {
      targetConditions.push({ userId: session.userId });
      targetConditions.push({ userId: session.userId.toString() });
    }
    if (session?.username) {
      targetConditions.push({ username: session.username.toLowerCase() });
      targetConditions.push({ username: session.username });
    }
    if (session?.email) {
      targetConditions.push({ email: session.email.toLowerCase().trim() });
    }
    if (emailParam) {
      const cleanEmail = emailParam.toLowerCase().trim();
      targetConditions.push({ email: cleanEmail });
      try {
        const uDoc = await db.collection('users').findOne({ email: cleanEmail });
        if (uDoc) {
          targetConditions.push({ userId: uDoc._id.toString() });
          targetConditions.push({ username: uDoc.username });
        }
      } catch {}
    }

    const query = { $or: targetConditions };

    const items = await notifsCol
      .find(query)
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    return NextResponse.json({
      success: true,
      notifications: items.map(n => ({
        id: n._id.toString(),
        title: n.title,
        message: n.message,
        type: n.type || 'promo',
        read: Boolean(n.read),
        createdAt: n.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Broadcast Push Notification (Admin)
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role === 'player') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin only.' }, { status: 403 });
    }

    const body = await req.json();
    const { title, message, target = 'all', channel = 'all', segment = 'all', url = '/' } = body;

    if (!title || !message) {
      return NextResponse.json({ success: false, error: 'Title and message are required.' }, { status: 400 });
    }

    const db = await getDb();
    const notifsCol = db.collection('notifications');

    // Save in-app notification & broadcast record
    const newRecord = {
      title: title.trim(),
      message: message.trim(),
      target,
      channel,
      segment,
      url,
      type: 'broadcast',
      sentBy: session.username || 'Admin',
      createdAt: new Date(),
    };

    const res = await notifsCol.insertOne(newRecord);

    // Send push notification via FCM / WebPush (fail-safe non-blocking)
    sendPushNotification({
      topic: 'vegas_all_players',
      title: title.trim(),
      body: message.trim(),
      data: { url },
    }).catch((fcmErr) => {
      console.warn('FCM delivery note:', fcmErr.message);
    });

    // Send email dispatch to players in background if channel is 'all' or 'email'
    if (channel === 'all' || channel === 'email') {
      (async () => {
        try {
          const { sendEmail } = await import('@/lib/email');
          const usersCol = db.collection('users');
          let userFilter = { role: 'player' };
          if (target !== 'all' && target.includes('@')) {
            userFilter = { email: target.toLowerCase().trim() };
          }
          const targetUsers = await usersCol
            .find(userFilter, { projection: { email: 1, username: 1 } })
            .limit(100)
            .toArray();

          for (const u of targetUsers) {
            if (u.email) {
              const html = `
                <div style="background-color: #070514; color: #FFFFFF; padding: 40px 24px; font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 540px; margin: auto; border-radius: 16px; border: 1px solid rgba(0, 240, 255, 0.35); text-align: center;">
                  <img src="https://playersparadisehub.com/logo.png" alt="Players Paradise" style="height: 52px; margin-bottom: 8px;" />
                  <h1 style="color: #00F0FF; margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 1px;">PLAYERS PARADISE</h1>
                  <p style="color: #E026D8; font-size: 11px; margin: 4px 0 20px 0; text-transform: uppercase; letter-spacing: 2px;">Official Player Broadcast</p>
                  <div style="background: #0E0A24; border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 12px; padding: 22px; text-align: left; margin: 20px 0;">
                    <h2 style="font-size: 18px; margin: 0 0 10px 0; color: #FFFFFF;">${title.trim()}</h2>
                    <p style="font-size: 14px; color: #CBD5E1; line-height: 1.6; margin: 0;">${message.trim()}</p>
                  </div>
                  <a href="${url && url.startsWith('http') ? url : `https://playersparadisehub.com${url}`}" style="display: inline-block; background: linear-gradient(135deg, #00F0FF 0%, #E026D8 100%); color: #070514; font-weight: 900; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-size: 14px; letter-spacing: 0.5px;">
                    ACCESS NOW &amp; PLAY
                  </a>
                  <p style="margin-top: 30px; font-size: 11px; color: #64748B;">You received this update because you are a registered player at Players Paradise.</p>
                </div>
              `;
              sendEmail({ to: u.email, subject: `🎰 Players Paradise: ${title.trim()}`, html }).catch(() => {});
            }
          }
        } catch (emailErr) {
          console.warn('Broadcast email batch note:', emailErr.message);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      message: `Broadcast successfully dispatched via [${channel.toUpperCase()}] to [${segment.toUpperCase()}]!`,
      broadcast: { ...newRecord, id: res.insertedId.toString() },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: Player subscribes to Web Push & VIP Broadcast Alerts
export async function PUT(req) {
  try {
    const session = await getSessionUser();
    const body = await req.json();
    const email = (session?.email || body.email || '').toLowerCase().trim();
    const fcmToken = body.token || body.fcmToken || null;
    const device = body.device || 'web_chrome';

    if (!email) {
      return NextResponse.json({ success: false, error: 'Email is required' }, { status: 400 });
    }

    const db = await getDb();
    const subsCol = db.collection('subscriptions');
    const usersCol = db.collection('users');

    await subsCol.updateOne(
      { email },
      {
        $set: {
          email,
          fcmToken,
          device,
          userId: session?.userId || null,
          username: session?.username || email.split('@')[0],
          isSubscribed: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    if (session?.userId) {
      await usersCol.updateOne(
        getUserFilter(session),
        { $set: { isSubscribed: true } }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to VIP Broadcasts & Chrome Push Notifications!',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH: Mark user notifications as read
export async function PATCH(req) {
  try {
    const session = await getSessionUser();
    const body = await req.json().catch(() => ({}));
    const email = (session?.email || body.email || '').toLowerCase().trim();
    const userId = session?.userId ? session.userId.toString() : null;

    if (!email && !userId) {
      return NextResponse.json({ success: false, error: 'User identification required.' }, { status: 400 });
    }

    const db = await getDb();
    const notifsCol = db.collection('notifications');

    const filterConditions = [];
    if (userId) {
      filterConditions.push({ userId });
    }
    if (email) {
      filterConditions.push({ email });
    }

    if (filterConditions.length > 0) {
      await notifsCol.updateMany(
        { $or: filterConditions },
        { $set: { read: true, readAt: new Date() } }
      );
    }

    return NextResponse.json({ success: true, message: 'Notifications marked as read.' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
