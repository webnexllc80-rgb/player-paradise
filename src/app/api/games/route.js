import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';
import { ensureDbInitialized } from '@/lib/initDb';

export async function GET(req) {
  try {
    await ensureDbInitialized();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const all = searchParams.get('all') === 'true';

    const db = await getDb();
    const gamesCol = db.collection('games');

    const query = {};
    if (!all) {
      query.isActive = { $ne: false };
    }
    if (category && category !== 'all' && category !== 'lobby') {
      query.category = category.toLowerCase();
    }

    const games = await gamesCol.find(query).sort({ isFeatured: -1, playsCount: -1 }).toArray();

    return NextResponse.json({
      success: true,
      games: games.map(g => ({
        id: g._id.toString(),
        gameId: g.gameId,
        title: g.title,
        category: g.category || 'sweepstakes',
        provider: g.provider || 'Players Paradise Studio',
        thumbnail: g.thumbnail || '/images/vegas-777.webp',
        type: g.type || 'internal',
        url: g.url || null,
        badge: g.badge || (g.isHot ? 'HOT' : (g.isFeatured ? 'EXCLUSIVE' : '')),
        isActive: g.isActive !== false,
        isHot: g.isHot ?? false,
        isFeatured: g.isFeatured ?? false,
        playsCount: g.playsCount || 0,
      })),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Admin Add Game
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Super Admin only.' }, { status: 403 });
    }

    const body = await req.json();
    const { title, provider, thumbnail, type = 'internal', url, badge, isActive } = body;

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required.' }, { status: 400 });
    }

    const db = await getDb();
    const gamesCol = db.collection('games');

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const normalizedBadge = (badge || '').toUpperCase().trim();
    const newGame = {
      gameId: slug + '-' + Math.floor(Math.random() * 1000),
      title,
      category: body.category ? body.category.toLowerCase() : 'sweepstakes',
      provider: provider || 'Players Paradise Studio',
      thumbnail: thumbnail || '/images/vegas-777.webp',
      type: type || 'internal',
      url: url || '',
      badge: normalizedBadge,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      isHot: normalizedBadge === 'HOT',
      isFeatured: normalizedBadge === 'EXCLUSIVE' || normalizedBadge === 'POPULAR',
      playsCount: 0,
      createdAt: new Date(),
    };

    const res = await gamesCol.insertOne(newGame);
    return NextResponse.json({
      success: true,
      gameId: res.insertedId.toString(),
      message: 'Game added successfully',
      game: { ...newGame, id: res.insertedId.toString() }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Admin Edit Game
export async function PUT(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Super Admin only.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, title, provider, thumbnail, isActive, badge, url, category } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Game ID required' }, { status: 400 });
    }

    const db = await getDb();
    const gamesCol = db.collection('games');

    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (provider !== undefined) updateFields.provider = provider;
    if (thumbnail !== undefined) updateFields.thumbnail = thumbnail;
    if (url !== undefined) updateFields.url = url;
    if (category !== undefined) updateFields.category = category.toLowerCase();
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);
    if (badge !== undefined) {
      const normalizedBadge = (badge || '').toUpperCase().trim();
      updateFields.badge = normalizedBadge;
      updateFields.isHot = normalizedBadge === 'HOT';
      updateFields.isFeatured = normalizedBadge === 'EXCLUSIVE' || normalizedBadge === 'POPULAR';
    }

    function getGameFilter(targetId) {
      if (!targetId) return null;
      const is24Hex = typeof targetId === 'string' && targetId.length === 24 && /^[0-9a-fA-F]{24}$/.test(targetId);
      if (is24Hex && ObjectId.isValid(targetId)) {
        return { $or: [{ _id: new ObjectId(targetId) }, { _id: targetId }, { id: targetId }] };
      }
      return { $or: [{ _id: targetId }, { id: targetId }] };
    }

    await gamesCol.updateOne(getGameFilter(id), { $set: updateFields });

    return NextResponse.json({ success: true, message: 'Game updated successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Admin Delete Game
export async function DELETE(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Super Admin only.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Game ID required' }, { status: 400 });
    }

    const db = await getDb();
    const gamesCol = db.collection('games');

    function getGameFilter(targetId) {
      if (!targetId) return null;
      const is24Hex = typeof targetId === 'string' && targetId.length === 24 && /^[0-9a-fA-F]{24}$/.test(targetId);
      if (is24Hex && ObjectId.isValid(targetId)) {
        return { $or: [{ _id: new ObjectId(targetId) }, { _id: targetId }, { id: targetId }] };
      }
      return { $or: [{ _id: targetId }, { id: targetId }] };
    }

    await gamesCol.deleteOne(getGameFilter(id));
    return NextResponse.json({ success: true, message: 'Game deleted successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
