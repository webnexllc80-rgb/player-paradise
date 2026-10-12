import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { ensureDbInitialized } from '@/lib/initDb';

export async function GET() {
  try {
    await ensureDbInitialized();
    const session = await getSessionUser();

    if (!session) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const db = await getDb();
    const usersCol = db.collection('users');

    let user = null;
    try {
      if (ObjectId.isValid(session.userId)) {
        user = await usersCol.findOne({ _id: new ObjectId(session.userId) });
      }
    } catch {}

    if (!user) {
      user = await usersCol.findOne({ email: session.email });
    }

    if (!user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        balanceSC: Number(user.balanceSC || 0),
        balanceGC: Number(user.balanceGC || 0),
        vipTier: user.vipTier || 'Bronze Panda',
        kycStatus: user.kycStatus || 'unverified',
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Session retrieval error:', err);
    return NextResponse.json({ authenticated: false, user: null, error: err.message });
  }
}
