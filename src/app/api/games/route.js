import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';
import { ensureDbInitialized } from '@/lib/initDb';
import { getGameThumbnail } from '@/lib/gameAssets';
import { compressDataUrlIfNeeded } from '@/lib/serverImageCompress';
import { cache } from '@/lib/cache';

function isPlaceholderImage(val) {
  return (
    !val ||
    typeof val !== 'string' ||
    val === '/images/vegas-777.webp' ||
    val === '/images/vegas-777.svg' ||
    val.endsWith('.svg')
  );
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const category = (searchParams.get('category') || '').trim().toLowerCase();
    const search = (searchParams.get('search') || '').trim();
    const all = searchParams.get('all') === 'true';

    const cacheKey = `games_${all ? 'all' : 'active'}_${category || 'all'}_${search.toLowerCase()}`;
    const cachedGames = cache.get(cacheKey);
    if (cachedGames) {
      return NextResponse.json(
        { success: true, games: cachedGames },
        {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Cache': 'HIT',
          },
        }
      );
    }

    const db = await getDb();
    const gamesCol = db.collection('games');

    const query = {};
    if (!all) {
      query.isActive = { $ne: false };
    }
    if (category && category !== 'all' && category !== 'lobby') {
      if (category === 'sweeps' || category === 'sweepstakes') {
        query.category = { $in: ['sweeps', 'sweepstakes'] };
      } else if (category === 'crash' || category === 'arcade') {
        query.category = { $in: ['crash', 'arcade'] };
      } else {
        query.category = category;
      }
    }
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { provider: { $regex: escaped, $options: 'i' } },
        { platform: { $regex: escaped, $options: 'i' } },
      ];
    }

    const games = await gamesCol
      .find(query)
      .sort({ createdAt: -1, isFeatured: -1, playsCount: -1 })
      .toArray();

    const mappedGames = await Promise.all(
      games.map(async (g) => {
        const sid = g._id ? g._id.toString() : (g.id || g.gameId);
        const rawThumb = g.thumbnail || g.image || g.imageUrl;

        let resolvedImage;
        if (!isPlaceholderImage(rawThumb)) {
          if (rawThumb.startsWith('data:image') && rawThumb.length > 160_000) {
            resolvedImage = await compressDataUrlIfNeeded(rawThumb, {
              maxChars: 90_000,
              maxSize: 500,
              quality: 82,
            });
            if (resolvedImage !== rawThumb && g._id) {
              gamesCol
                .updateOne(
                  { _id: g._id },
                  { $set: { thumbnail: resolvedImage, image: resolvedImage, imageUrl: resolvedImage } }
                )
                .catch(() => {});
            }
          } else {
            resolvedImage = rawThumb;
          }
        } else {
          resolvedImage = getGameThumbnail(g.title, '/images/vegas-777.webp');
        }

        return {
          id: sid,
          _id: sid,
          gameId: g.gameId || sid,
          title: g.title,
          category: g.category || 'sweeps',
          provider: g.provider || 'Players Paradise Studio',
          thumbnail: resolvedImage,
          image: resolvedImage,
          imageUrl: resolvedImage,
          fallbackImage: resolvedImage,
          hasCustomImage: Boolean(g.hasCustomImage || !isPlaceholderImage(rawThumb)),
          type: g.type || 'internal',
          url: g.url || null,
          playUrl: g.playUrl || g.url || null,
          badge: g.badge || (g.isHot ? 'HOT' : (g.isFeatured ? 'EXCLUSIVE' : '')),
          isActive: g.isActive !== false,
          isHot: g.isHot ?? false,
          isFeatured: g.isFeatured ?? false,
          playsCount: g.playsCount || 0,
          description: g.description || '',
          platform: g.platform || g.provider || 'Players Paradise',
          isInternal: g.isInternal ?? (g.type === 'internal'),
          rtp: g.rtp || 98.2,
          rating: g.rating || 4.9,
          createdAt: g.createdAt || null,
        };
      })
    );

    // Cache in RAM (invalidated immediately on POST/PUT/DELETE)
    cache.set(cacheKey, mappedGames, 120);

    return NextResponse.json(
      {
        success: true,
        games: mappedGames,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Cache': 'MISS',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Helper for safe game lookup
function getGameFilter(targetId) {
  if (!targetId) return { _id: null };
  const strId = String(targetId);
  const or = [
    { _id: strId },
    { id: strId },
    { gameId: strId },
  ];
  if (/^[0-9a-fA-F]{24}$/.test(strId)) {
    try {
      or.push({ _id: new ObjectId(strId) });
    } catch {}
  }
  return { $or: or };
}

// Admin Add Game
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session || (session.role !== ROLES.SUPER_ADMIN && session.role !== ROLES.ADMIN && session.role !== ROLES.OPERATION_ADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Staff only.' }, { status: 403 });
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
    const gameId = slug + '-' + Math.floor(Math.random() * 1000);
    const rawImg = thumbnail || body.image || body.imageUrl;
    const hasCustomImage = !isPlaceholderImage(rawImg);

    let resolvedImage;
    if (hasCustomImage) {
      resolvedImage = rawImg.startsWith('data:image')
        ? await compressDataUrlIfNeeded(rawImg, { maxChars: 90_000, maxSize: 500, quality: 82 })
        : rawImg;
    } else {
      resolvedImage = getGameThumbnail(title, '/images/vegas-777.webp');
    }

    const newGame = {
      gameId,
      title: title.trim(),
      category: body.category ? body.category.toLowerCase() : 'sweeps',
      provider: provider || 'Players Paradise Studio',
      thumbnail: resolvedImage,
      image: resolvedImage,
      imageUrl: resolvedImage,
      fallbackImage: resolvedImage,
      hasCustomImage,
      type: type || 'internal',
      url: url || '',
      playUrl: url || '',
      badge: normalizedBadge,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      isHot: normalizedBadge === 'HOT',
      isFeatured: normalizedBadge === 'EXCLUSIVE' || normalizedBadge === 'POPULAR',
      playsCount: 0,
      description: body.description || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await gamesCol.insertOne(newGame);
    const idStr = res.insertedId ? res.insertedId.toString() : gameId;
    cache.del('games');
    return NextResponse.json({
      success: true,
      gameId: idStr,
      message: 'Game added successfully',
      game: { ...newGame, id: idStr, _id: idStr }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Admin Edit Game
export async function PUT(req) {
  try {
    const session = await getSessionUser();
    if (!session || (session.role !== ROLES.SUPER_ADMIN && session.role !== ROLES.ADMIN && session.role !== ROLES.OPERATION_ADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Staff only.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, title, provider, thumbnail, isActive, badge, url, category } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Game ID required' }, { status: 400 });
    }

    const db = await getDb();
    const gamesCol = db.collection('games');

    const updateFields = { updatedAt: new Date() };
    if (title !== undefined) updateFields.title = title.trim();
    if (provider !== undefined) updateFields.provider = provider;

    const rawThumb = thumbnail !== undefined ? thumbnail : (body.image !== undefined ? body.image : body.imageUrl);
    if (rawThumb !== undefined) {
      const hasCustom = !isPlaceholderImage(rawThumb);
      const resolvedThumb = hasCustom
        ? (rawThumb.startsWith('data:image')
            ? await compressDataUrlIfNeeded(rawThumb, { maxChars: 90_000, maxSize: 500, quality: 82 })
            : rawThumb)
        : getGameThumbnail(title, '/images/vegas-777.webp');
      updateFields.thumbnail = resolvedThumb;
      updateFields.image = resolvedThumb;
      updateFields.imageUrl = resolvedThumb;
      updateFields.fallbackImage = resolvedThumb;
      updateFields.hasCustomImage = hasCustom;
    }

    if (url !== undefined) {
      updateFields.url = url;
      updateFields.playUrl = url;
    }
    if (category !== undefined) updateFields.category = category.toLowerCase();
    if (body.description !== undefined) updateFields.description = body.description;
    if (isActive !== undefined) updateFields.isActive = Boolean(isActive);
    if (badge !== undefined) {
      const normalizedBadge = (badge || '').toUpperCase().trim();
      updateFields.badge = normalizedBadge;
      updateFields.isHot = normalizedBadge === 'HOT';
      updateFields.isFeatured = normalizedBadge === 'EXCLUSIVE' || normalizedBadge === 'POPULAR';
    }

    await gamesCol.updateOne(getGameFilter(id), { $set: updateFields });
    cache.del('games');

    return NextResponse.json({ success: true, message: 'Game updated successfully', updatedFields: updateFields });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Admin Delete Game
export async function DELETE(req) {
  try {
    const session = await getSessionUser();
    if (!session || (session.role !== ROLES.SUPER_ADMIN && session.role !== ROLES.ADMIN && session.role !== ROLES.OPERATION_ADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Staff only.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Game ID required' }, { status: 400 });
    }

    const db = await getDb();
    const gamesCol = db.collection('games');

    await gamesCol.deleteOne(getGameFilter(id));
    cache.del('games');
    return NextResponse.json({ success: true, message: 'Game deleted successfully' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
