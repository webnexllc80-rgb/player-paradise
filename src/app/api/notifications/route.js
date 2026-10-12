import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// GET notifications
export async function GET(req) {
  try {
    const session = await getSessionUser();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || session?.email;

    if (!email) {
      return NextResponse.json({ success: true, notifications: [] });
    }

    const db = await getDb();
    const notifsCol = db.collection('notifications');

    const notifs = await notifsCol
      .find({
        $or: [{ userEmail: email.toLowerCase() }, { global: true }],
      })
      .sort({ createdAt: -1 })
      .limit(30)
      .toArray();

    return NextResponse.json({
      success: true,
      notifications: notifs.map((n) => ({
        id: n._id ? n._id.toString() : n.id,
        title: n.title,
        message: n.message,
        type: n.type || 'INFO',
        read: !!n.read,
        createdAt: n.createdAt,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Mark notification as read
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, markAll, email } = body;

    const db = await getDb();
    const notifsCol = db.collection('notifications');

    if (markAll && email) {
      await notifsCol.updateMany({ userEmail: email.toLowerCase() }, { $set: { read: true } });
      return NextResponse.json({ success: true, message: 'All marked as read.' });
    }

    if (id) {
      let filter = { _id: id };
      if (ObjectId.isValid(id)) filter = { _id: new ObjectId(id) };
      await notifsCol.updateOne(filter, { $set: { read: true } });
      return NextResponse.json({ success: true, message: 'Marked as read.' });
    }

    return NextResponse.json({ success: false, error: 'Missing parameters.' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
