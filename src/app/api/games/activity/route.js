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

    // If database is new/empty, provide realistic default ticker items
    const fallbackTicker = [
      { username: 'raze', game: 'Vegas 777 Deluxe', amount: 7016.45, currency: 'SC' },
      { username: 'nyx', game: 'Golden Treasure', amount: 2118.14, currency: 'SC' },
      { username: 'satoshi.j', game: 'Neon Rocket Crash', amount: 6990.66, currency: 'SC' },
      { username: 'halcyon', game: 'Fire Kirin', amount: 3410.00, currency: 'SC' },
      { username: 'crypto_ace', game: 'Blackjack High Roller', amount: 4800.00, currency: 'SC' },
      { username: 'lucky_bella', game: 'Orion Stars', amount: 1520.25, currency: 'SC' },
      { username: 'drake99', game: 'Royal European Roulette', amount: 5600.00, currency: 'SC' },
    ];

    const displayWins = recentWins.length > 0
      ? recentWins.map(w => ({
          username: w.username,
          game: w.gameId.replace(/-/g, ' ').toUpperCase(),
          amount: w.winAmount,
          currency: w.currency || 'SC',
        }))
      : fallbackTicker;

    return NextResponse.json({
      success: true,
      ticker: displayWins,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
