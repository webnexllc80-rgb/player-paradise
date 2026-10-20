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
    const emailRegex = { $regex: new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };

    // 1. Fetch from gameAccounts collection
    const accounts = await db
      .collection('gameAccounts')
      .find({ userEmail: emailRegex, status: 'READY' })
      .toArray();

    // 2. Also fetch approved READY requests from accountRequests
    const readyRequests = await db
      .collection('accountRequests')
      .find({ userEmail: emailRegex, status: 'READY' })
      .toArray();

    // 3. Fetch any PENDING account requests
    const pending = await db
      .collection('accountRequests')
      .find({
        userEmail: emailRegex,
        status: 'PENDING',
        requestType: { $ne: 'COIN_LOAD' },
      })
      .toArray();

    const mergedMap = new Map();
    accounts.forEach((acc) => {
      const key = (acc.gameTitle || '').toLowerCase().trim();
      mergedMap.set(key, {
        id: acc._id.toString(),
        userEmail: acc.userEmail,
        gameTitle: acc.gameTitle,
        username: acc.username,
        password: acc.password,
        status: acc.status || 'READY',
        createdAt: acc.createdAt || new Date(),
      });
    });

    readyRequests.forEach((req) => {
      const key = (req.gameTitle || '').toLowerCase().trim();
      if (!mergedMap.has(key)) {
        mergedMap.set(key, {
          id: req._id.toString(),
          userEmail: req.userEmail,
          gameTitle: req.gameTitle,
          username: req.gameAccountUsername || req.userName,
          password: req.gameAccountPassword || 'VegasWin777!',
          status: 'READY',
          createdAt: req.createdAt || new Date(),
        });
      }
    });

    return NextResponse.json({
      success: true,
      gameAccounts: Array.from(mergedMap.values()),
      pendingRequests: pending.map((p) => ({
        id: p._id.toString(),
        gameTitle: p.gameTitle,
        status: 'PENDING',
        createdAt: p.createdAt || new Date(),
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
