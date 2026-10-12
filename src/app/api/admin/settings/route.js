import { NextResponse } from 'next/server';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const settingsCol = db.collection('settings');
    const settings = (await settingsCol.findOne({ key: 'general' })) || {
      siteName: 'Players Paradise Hub',
      welcomeBonusSC: 5.0,
      minWithdrawal: 25.0,
      maintenanceMode: false,
      supportEmail: 'support@playersparadisehub.com',
      telegramSupport: '@PlayersParadiseSupport',
    };

    return NextResponse.json({ success: true, settings });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 403 });
    }

    const body = await req.json();
    const db = await getDb();
    const settingsCol = db.collection('settings');

    await settingsCol.updateOne(
      { key: 'general' },
      {
        $set: {
          key: 'general',
          siteName: body.siteName || 'Players Paradise Hub',
          welcomeBonusSC: parseFloat(body.welcomeBonusSC) || 5.0,
          minWithdrawal: parseFloat(body.minWithdrawal) || 25.0,
          maintenanceMode: !!body.maintenanceMode,
          supportEmail: body.supportEmail || 'support@playersparadisehub.com',
          telegramSupport: body.telegramSupport || '@PlayersParadiseSupport',
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: 'Settings saved successfully!' });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
