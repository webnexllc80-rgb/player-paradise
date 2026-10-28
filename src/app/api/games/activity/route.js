import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode') || 'ticker'; // 'ticker' or 'admin'
    const limit = parseInt(searchParams.get('limit') || '20');

    const db = await getDb();
    const activityCol = db.collection('game_activity');

    if (mode === 'admin') {
      const session = await getSessionUser();
      if (!session || (session.role !== ROLES.SUPER_ADMIN && session.role !== ROLES.FINANCIAL_MANAGER)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
      }

      const activities = await activityCol
        .find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return NextResponse.json({
        success: true,
        activities: activities.map(a => ({
          id: a._id.toString(),
          gameId: a.gameId,
          username: a.username,
          betAmount: a.betAmount,
          winAmount: a.winAmount,
          multiplier: a.multiplier,
          currency: a.currency,
          outcome: a.outcome,
          createdAt: a.createdAt,
        })),
      });
    }

    // Ticker mode (Public)
    const recentWins = await activityCol
      .find({ winAmount: { $gt: 0 } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // If database is new/empty, provide ticker items strictly using real admin games
    let fallbackTicker = [];
    if (recentWins.length === 0) {
      const dbGames = await db.collection('games').find({ isActive: { $ne: false } }).limit(10).toArray();
      const realNames = dbGames.map(g => (g.title || '').trim()).filter(Boolean);
      const players = ['raze', 'nyx', 'halcyon', 'crypto_ace', 'lucky_bella', 'drake99', 'matrix_win'];
      const amounts = [340.5, 820.0, 1250.0, 490.75, 620.0, 750.2, 1100.0];
      fallbackTicker = players.map((u, i) => ({
        username: u,
        game: realNames[i % (realNames.length || 1)] || 'Ultra Panda',
        gameTitle: realNames[i % (realNames.length || 1)] || 'Ultra Panda',
        amount: amounts[i % amounts.length],
        currency: 'SC',
      }));
    }

    const displayWins = recentWins.length > 0
      ? recentWins.map(w => ({
          username: w.username,
          game: w.gameTitle || (w.gameId ? w.gameId.replace(/-/g, ' ').toUpperCase() : 'Ultra Panda'),
          gameTitle: w.gameTitle || (w.gameId ? w.gameId.replace(/-/g, ' ').toUpperCase() : 'Ultra Panda'),
          amount: w.winAmount,
          currency: w.currency || 'SC',
        }))
      : fallbackTicker;

    return NextResponse.json({
      success: true,
      ticker: displayWins,
      activity: displayWins,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
