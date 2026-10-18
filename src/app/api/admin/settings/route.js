import { NextResponse } from 'next/server';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const settings = await db.collection('system_settings').findOne({ key: 'general' });
    const defaultSettings = {
      siteName: 'Players Paradise',
      welcomeBonusPercent: 300,
      welcomeBonusMax: 7500,
      welcomeBonusSpins: 150,
      welcomeBonusTitle: 'WELCOME BONUS',
      welcomeBonusSubtitle: 'Get a 300% bonus on your first deposit! Instant approval & fast cashouts.',
      regularBonusPercent: 50,
      regularBonusMax: 2500,
      regularBonusTitle: 'REGULAR BONUS',
      regularBonusSubtitle: 'Get a 50% reload bonus on every deposit you make! Boost your wallet balance anytime.',
      referralBonusPercent: 20,
      signupBonusSC: 5.0,
      signupBonusGC: 50000,
      minRedemptionSC: 50.0,
      geoRestrictionEnabled: false,
      restrictedStates: [],
      maintenanceMode: false,
    };
    const merged = { ...defaultSettings, ...(settings || {}), restrictedStates: [] };

    // Clean up legacy template text from database if present
    if (merged.welcomeBonusTitle === 'TRIPLE TIER WELCOME PACK') {
      merged.welcomeBonusTitle = 'WELCOME BONUS';
    }
    if (merged.welcomeBonusSubtitle?.includes('Sovereign Status')) {
      merged.welcomeBonusSubtitle = 'Get a 300% bonus on your first deposit! Instant approval & fast cashouts.';
    }
    if (merged.regularBonusTitle === 'REGULAR RELOAD BOOST') {
      merged.regularBonusTitle = 'REGULAR BONUS';
    }
    if (merged.regularBonusSubtitle?.includes('Unlimited reload boost')) {
      merged.regularBonusSubtitle = 'Get a 50% reload bonus on every deposit you make! Boost your wallet balance anytime.';
    }

    // Persist clean copy to DB
    await db.collection('system_settings').updateOne(
      { key: 'general' },
      {
        $set: {
          welcomeBonusTitle: merged.welcomeBonusTitle,
          welcomeBonusSubtitle: merged.welcomeBonusSubtitle,
          regularBonusTitle: merged.regularBonusTitle,
          regularBonusSubtitle: merged.regularBonusSubtitle,
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true, settings: merged });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== ROLES.SUPER_ADMIN) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Super Admin only.' }, { status: 403 });
    }

    const body = await req.json();
    const db = await getDb();
    const settingsCol = db.collection('system_settings');

    const updateFields = {
      updatedAt: new Date(),
      updatedBy: session.username,
    };

    if (body.geoRestrictionEnabled !== undefined) updateFields.geoRestrictionEnabled = Boolean(body.geoRestrictionEnabled);
    if (body.restrictedStates !== undefined) updateFields.restrictedStates = body.restrictedStates;
    if (body.maintenanceMode !== undefined) updateFields.maintenanceMode = Boolean(body.maintenanceMode);
    if (body.signupBonusSC !== undefined) updateFields.signupBonusSC = Number(body.signupBonusSC);
    if (body.signupBonusGC !== undefined) updateFields.signupBonusGC = Number(body.signupBonusGC);
    if (body.minRedemptionSC !== undefined) updateFields.minRedemptionSC = Number(body.minRedemptionSC);

    // Dynamic Welcome & Regular Bonus Settings
    if (body.welcomeBonusPercent !== undefined) updateFields.welcomeBonusPercent = Number(body.welcomeBonusPercent);
    if (body.welcomeBonusMax !== undefined) updateFields.welcomeBonusMax = Number(body.welcomeBonusMax);
    if (body.welcomeBonusSpins !== undefined) updateFields.welcomeBonusSpins = Number(body.welcomeBonusSpins);
    if (body.welcomeBonusTitle !== undefined) updateFields.welcomeBonusTitle = String(body.welcomeBonusTitle);
    if (body.welcomeBonusSubtitle !== undefined) updateFields.welcomeBonusSubtitle = String(body.welcomeBonusSubtitle);

    if (body.regularBonusPercent !== undefined) updateFields.regularBonusPercent = Number(body.regularBonusPercent);
    if (body.regularBonusMax !== undefined) updateFields.regularBonusMax = Number(body.regularBonusMax);
    if (body.regularBonusTitle !== undefined) updateFields.regularBonusTitle = String(body.regularBonusTitle);
    if (body.regularBonusSubtitle !== undefined) updateFields.regularBonusSubtitle = String(body.regularBonusSubtitle);

    if (body.referralBonusPercent !== undefined) updateFields.referralBonusPercent = Number(body.referralBonusPercent);

    await settingsCol.updateOne(
      { key: 'general' },
      { $set: updateFields },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: 'Settings saved successfully.' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
