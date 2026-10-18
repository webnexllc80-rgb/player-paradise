import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'gameScreenshot'; // or 'qrCodeImage'

    if (!id) {
      return new NextResponse('Missing ID', { status: 400 });
    }

    const db = await getDb();
    const redemptionsCol = db.collection('redemptions');

    const is24Hex = typeof id === 'string' && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
    const filter = is24Hex && ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] }
      : { $or: [{ _id: id }, { id: id }] };

    const redemption = await redemptionsCol.findOne(filter, {
      projection: { gameScreenshot: 1, qrCodeImage: 1 },
    });

    const rawData = type === 'qrCodeImage' ? redemption?.qrCodeImage : redemption?.gameScreenshot;

    if (!rawData) {
      return new NextResponse('Image not found', { status: 404 });
    }

    if (rawData.startsWith('data:')) {
      const parts = rawData.split(',');
      const mime = parts[0].split(':')[1].split(';')[0];
      const buffer = Buffer.from(parts[1], 'base64');

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mime,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    return NextResponse.redirect(rawData);
  } catch (err) {
    return new NextResponse('Server Error: ' + err.message, { status: 500 });
  }
}
