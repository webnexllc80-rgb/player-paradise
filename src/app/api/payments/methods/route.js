import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';
import { ensureDbInitialized } from '@/lib/initDb';

// GET active payment methods
export async function GET() {
  try {
    await ensureDbInitialized();
    const db = await getDb();
    const methods = await db.collection('paymentMethods').find({ active: true }).toArray();

    return NextResponse.json({
      success: true,
      methods: methods.map((m) => ({
        id: m._id ? m._id.toString() : m.id,
        methodId: m.methodId,
        name: m.name,
        displayName: m.displayName || m.name,
        icon: m.icon || 'DollarSign',
        tag: m.tag || '',
        instructions: m.instructions || '',
        qrCodeUrl: m.qrCodeUrl || '',
        minDeposit: m.minDeposit || 10,
        maxDeposit: m.maxDeposit || 5000,
        minWithdrawal: m.minWithdrawal || 25,
        maxWithdrawal: m.maxWithdrawal || 5000,
        badge: m.badge || '',
        active: m.active !== false,
      })),
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST: Admin adds or updates payment method
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role === ROLES.PLAYER) {
      return NextResponse.json({ success: false, error: 'Unauthorized staff access.' }, { status: 403 });
    }

    const body = await req.json();
    const { methodId, name, tag, instructions, minDeposit, maxDeposit, active } = body;

    const db = await getDb();
    const methodsCol = db.collection('paymentMethods');

    const existing = await methodsCol.findOne({ methodId });
    if (existing) {
      await methodsCol.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: name || existing.name,
            tag: tag || existing.tag,
            instructions: instructions || existing.instructions,
            minDeposit: Number(minDeposit) || existing.minDeposit,
            maxDeposit: Number(maxDeposit) || existing.maxDeposit,
            active: active !== undefined ? active : existing.active,
            updatedAt: new Date(),
          },
        }
      );
      return NextResponse.json({ success: true, message: 'Payment method updated successfully.' });
    }

    await methodsCol.insertOne({
      methodId,
      name,
      tag,
      instructions,
      minDeposit: Number(minDeposit) || 10,
      maxDeposit: Number(maxDeposit) || 5000,
      active: true,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, message: 'Payment method created successfully.' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
