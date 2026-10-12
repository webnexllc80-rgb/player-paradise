import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const activityCol = db.collection('activity');
    const recentWins = await activityCol.find({}).sort({ createdAt: -1 }).limit(15).toArray();

    // Default ticker items
    const fallbackWins = [
      { username: 'CyberAce77', gameTitle: 'Ultra Panda', amount: 340.5, currency: 'SC' },
      { username: 'PandaKing99', gameTitle: 'Panda 777 Slots', amount: 820.0, currency: 'SC' },
      { username: 'MatrixNeo', gameTitle: 'Cyber Matrix Crash', amount: 450.0, currency: 'SC' },
      { username: 'NeonHunter', gameTitle: 'Fire Kirin', amount: 1250.0, currency: 'SC' },
      { username: 'VortexPlayer', gameTitle: 'Orion Stars', amount: 290.75, currency: 'SC' },
      { username: 'ShadowBlade', gameTitle: 'Game Vault 999', amount: 620.0, currency: 'SC' },
      { username: 'LuckyPanda', gameTitle: 'Juwa 777', amount: 380.0, currency: 'SC' },
    ];

    const wins = recentWins.length > 0 ? recentWins : fallbackWins;

    return NextResponse.json({
      success: true,
      activity: wins.map((w) => ({
        username: w.username,
        gameTitle: w.gameTitle,
        amount: w.amount,
        currency: w.currency || 'SC',
        time: 'Just now',
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
