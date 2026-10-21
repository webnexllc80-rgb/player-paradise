import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return new NextResponse('Missing ID', { status: 400 });
    }

    const db = await getDb();
    const depositsCol = db.collection('deposits');

    const is24Hex = typeof id === 'string' && id.length === 24 && /^[0-9a-fA-F]{24}$/.test(id);
    const filter = is24Hex && ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id: id }] }
      : { $or: [{ _id: id }, { id: id }] };

    const deposit = await depositsCol.findOne(filter, {
      projection: { proofImage: 1, proofUrl: 1, receiptImage: 1, screenshot: 1 },
    });

    const rawData = deposit?.proofImage || deposit?.proofUrl || deposit?.receiptImage || deposit?.screenshot;

    if (!deposit || !rawData) {
      return new NextResponse('Proof not found', { status: 404 });
    }

    // If it's a data URL (e.g. data:image/png;base64,....)
    if (typeof rawData === 'string' && rawData.startsWith('data:')) {
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

    // If it's a direct URL
    return NextResponse.redirect(rawData);
  } catch (err) {
    return new NextResponse('Server Error: ' + err.message, { status: 500 });
  }
}
