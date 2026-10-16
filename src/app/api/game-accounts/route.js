import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionUser } from '@/lib/auth';

// GET game credentials (by player email)
export async function GET(req) {
  try {
    const session = await getSessionUser();
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || session?.email;

    if (!email) {
      return NextResponse.json({ success: true, gameAccounts: [] });
    }

    const db = await getDb();
    const cleanEmail = email.toLowerCase().trim();

    const accounts = await db
      .collection('gameAccounts')
      .find({ userEmail: cleanEmail, status: 'READY' })
      .toArray();

    return NextResponse.json({
      success: true,
      gameAccounts: accounts.map(acc => ({
        id: acc._id.toString(),
        userEmail: acc.userEmail,
        gameTitle: acc.gameTitle,
        username: acc.username,
        password: acc.password,
        status: acc.status || 'READY',
        createdAt: acc.createdAt || new Date(),
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
