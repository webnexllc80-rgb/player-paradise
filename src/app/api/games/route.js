import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';
import { ensureDbInitialized } from '@/lib/initDb';

// GET Games
export async function GET(req) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const db = await getDb();
    const gamesCol = db.collection('games');

    const query = { active: true };
    if (category && category !== 'all') {
      query.category = category;
    }
    if (search) {
      query.title = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    const games = await gamesCol.find(query).sort({ priority: 1 }).toArray();

    return NextResponse.json({
      success: true,
      games: games.map((g) => ({
        id: g.id || (g._id ? g._id.toString() : ''),
        title: g.title,
        category: g.category,
        isInternal: !!g.isInternal,
        platform: g.platform || '',
        playUrl: g.playUrl || '',
        rtp: g.rtp || 98.0,
        rating: g.rating || 4.9,
        badge: g.badge || '',
        image: g.image || '/images/vegas-777.svg',
        fallbackImage: g.fallbackImage || '',
        description: g.description || '',
        minBet: g.minBet || 1,
        maxBet: g.maxBet || 100,
        jackpot: g.jackpot || 50000,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST: Admin add game
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role === ROLES.PLAYER) {
      return NextResponse.json({ success: false, message: 'Unauthorized staff access.' }, { status: 403 });
    }

    const body = await req.json();
    const { title, category, isInternal, platform, playUrl, rtp, description, badge, image } = body;

    if (!title || !category) {
      return NextResponse.json({ success: false, message: 'Game title and category are required.' }, { status: 400 });
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const db = await getDb();
    const gamesCol = db.collection('games');

    const newGame = {
      id: slug,
      title,
      category,
      isInternal: !!isInternal,
      platform: platform || '',
      playUrl: playUrl || '',
      rtp: parseFloat(rtp) || 98.0,
      rating: 4.9,
      badge: badge || 'NEW',
      image: image || '/images/vegas-777.svg',
      description: description || '',
      active: true,
      createdAt: new Date(),
    };

    await gamesCol.insertOne(newGame);
    return NextResponse.json({ success: true, message: 'Game added successfully!', game: newGame });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
