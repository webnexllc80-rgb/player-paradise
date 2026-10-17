import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES, getUserFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { sendEmail } from '@/lib/email';

// GET: List Deposits (Admin / Financial Manager) or Player's own
export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const db = await getDb();
    const depositsCol = db.collection('deposits');

    const query = {};
    const isStaff =
      session.role === ROLES.SUPER_ADMIN ||
      session.role === ROLES.FINANCIAL_MANAGER ||
      session.role === ROLES.OPERATION_ADMIN;

    if (!isStaff) {
      query.userId = session.userId;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    const deposits = await depositsCol.find(query).sort({ createdAt: -1 }).limit(100).toArray();

    return NextResponse.json({
      success: true,
      deposits: deposits.map(d => {
        const bonusType = d.bonusType || 'welcome';
        const bonusPercent = d.bonusPercent ?? (bonusType === 'welcome' ? 300 : 50);
        const bonusSC = d.bonusSC !== undefined ? d.bonusSC : Number(((d.amount * bonusPercent) / 100).toFixed(2));
        const totalSC = d.totalSC !== undefined ? d.totalSC : Number((d.amount + bonusSC).toFixed(2));
        const totalGC = d.totalGC !== undefined ? d.totalGC : (d.amount * 10000);

        return {
          id: d._id.toString(),
          userId: d.userId,
          username: d.username,
          amount: d.amount,
          methodName: d.methodName,
          senderNote: d.senderNote || '',
          proofImage: d.proofImage || null,
          txHash: d.txHash || '',
          bonusType,
          bonusPercent,
          bonusSC,
          totalSC,
          totalGC,
          creditedSC: d.creditedSC || null,
          status: d.status,
          processedBy: d.processedBy || null,
          rejectReason: d.rejectReason || null,
          createdAt: d.createdAt,
        };
      }),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Player Submit Deposit Request
export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Please login.' }, { status: 401 });
    }

    const { amount, methodId, methodName, senderNote, proofImage, txHash } = await req.json();

    const depositAmount = Number(amount);
    if (!depositAmount || depositAmount < 5) {
      return NextResponse.json({ success: false, error: 'Minimum deposit is $5.00.' }, { status: 400 });
    }

    if (!methodName) {
      return NextResponse.json({ success: false, error: 'Payment method is required.' }, { status: 400 });
    }

    const db = await getDb();
    const depositsCol = db.collection('deposits');
    const usersCol = db.collection('users');
    const settingsCol = db.collection('system_settings');

    const [user, settings] = await Promise.all([
      usersCol.findOne(getUserFilter(session)),
      settingsCol.findOne({ key: 'general' }),
    ]);

    // Check whether player is claiming Welcome Bonus or Regular Bonus
    const hasClaimedWelcome = Boolean(user?.welcomeBonusClaimed || (user?.totalDeposited && user.totalDeposited > 0));
    const bonusType = hasClaimedWelcome ? 'regular' : 'welcome';
    const bonusPercent = hasClaimedWelcome
      ? Number(settings?.regularBonusPercent ?? 50)
      : Number(settings?.welcomeBonusPercent ?? 300);
    const bonusMax = hasClaimedWelcome
      ? Number(settings?.regularBonusMax ?? 2500)
      : Number(settings?.welcomeBonusMax ?? 7500);

    const bonusSC = Number(Math.min((depositAmount * bonusPercent) / 100, bonusMax).toFixed(2));
    const totalSC = Number((depositAmount + bonusSC).toFixed(2));
    const totalGC = depositAmount * 10000;

    const newDeposit = {
      userId: session.userId,
      username: session.username,
      amount: depositAmount,
      methodId: methodId || 'custom',
      methodName,
      senderNote: senderNote || '',
      proofImage: proofImage || null,
      txHash: txHash || '',
      bonusType,
      bonusPercent,
      bonusSC,
      totalSC,
      totalGC,
      status: 'pending',
      processedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const res = await depositsCol.insertOne(newDeposit);

    return NextResponse.json({
      success: true,
      depositId: res.insertedId.toString(),
      calculatedCoins: {
        totalSC,
        bonusSC,
        bonusType,
        totalGC,
      },
      message: 'Deposit submitted successfully! Our financial desk is verifying your transaction.',
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PUT: Financial Manager & Super Admin Approve / Reject Deposit
export async function PUT(req) {
  try {
    const session = await getSessionUser();
    const authorizedRoles = [
      ROLES.SUPER_ADMIN,
      ROLES.FINANCIAL_MANAGER,
      ROLES.OPERATION_ADMIN,
    ];
    if (!session || !authorizedRoles.includes(session.role)) {
      return NextResponse.json({ success: false, error: 'Unauthorized. Financial Manager access required.' }, { status: 403 });
    }

    const { depositId, action, rejectReason, customSC, customGC } = await req.json();

    if (!depositId || !action) {
      return NextResponse.json({ success: false, error: 'Deposit ID and action required.' }, { status: 400 });
    }

    const db = await getDb();
    const depositsCol = db.collection('deposits');
    const usersCol = db.collection('users');
    const ledgerCol = db.collection('ledger');

    const deposit = await depositsCol.findOne({ _id: new ObjectId(depositId) });
    if (!deposit) {
      return NextResponse.json({ success: false, error: 'Deposit record not found.' }, { status: 404 });
    }

    if (deposit.status !== 'pending') {
      return NextResponse.json({ success: false, error: `Deposit is already marked as ${deposit.status}.` }, { status: 400 });
    }

    const user = await usersCol.findOne({ _id: new ObjectId(deposit.userId) });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Associated player not found.' }, { status: 404 });
    }

    if (action === 'approve') {
      // Determine final coins to credit (use custom if provided, otherwise auto-calculated totalSC)
      const creditedSC = customSC !== undefined && customSC !== null && customSC !== ''
        ? Number(customSC)
        : (deposit.totalSC !== undefined ? Number(deposit.totalSC) : Number((deposit.amount + (deposit.bonusSC || 0)).toFixed(2)));
      const creditedGC = customGC !== undefined && customGC !== null && customGC !== ''
        ? Number(customGC)
        : (deposit.totalGC !== undefined ? Number(deposit.totalGC) : deposit.amount * 10000);

      const oldSC = user.balanceSC || 0;
      const newSC = Number((oldSC + creditedSC).toFixed(2));

      // 1. Credit Player Balance & mark welcome bonus claimed if first time
      const userUpdate = {
        $inc: {
          balanceSC: creditedSC,
          balanceGC: creditedGC,
          totalDeposited: deposit.amount,
        },
      };

      if (!user.welcomeBonusClaimed) {
        userUpdate.$set = { welcomeBonusClaimed: true };
      }

      await usersCol.updateOne({ _id: user._id }, userUpdate);

      // 2. Mark Deposit as Approved
      await depositsCol.updateOne(
        { _id: deposit._id },
        {
          $set: {
            status: 'approved',
            creditedSC,
            creditedGC,
            processedBy: `${session.username} (${session.role})`,
            updatedAt: new Date(),
          },
        }
      );

      // 3. Write Immutable Ledger
      await ledgerCol.insertOne({
        userId: user._id.toString(),
        username: user.username,
        type: 'deposit',
        currency: 'SC',
        amount: creditedSC,
        balanceBefore: oldSC,
        balanceAfter: newSC,
        performedBy: session.username,
        staffRole: session.role,
        referenceId: depositId,
        notes: `Deposit $${deposit.amount} approved (${creditedSC} SC credited: $${deposit.amount} base + ${deposit.bonusSC || 0} SC ${deposit.bonusType || 'welcome'} bonus). Method: ${deposit.methodName}. TXID: ${deposit.txHash || 'N/A'}`,
        createdAt: new Date(),
      });

      // 4. Check Affiliate Commission (50% commission if first deposit!)
      if (user.referredBy && (!user.totalDeposited || user.totalDeposited === 0)) {
        const referrer = await usersCol.findOne({ username: user.referredBy });
        if (referrer) {
          const commissionSC = Number((deposit.amount * 0.50).toFixed(2)); // 50% referral bonus based on cash amount
          await usersCol.updateOne(
            { _id: referrer._id },
            {
              $inc: {
                affiliateCommissionsUnpaid: commissionSC,
                affiliateCommissionsEarned: commissionSC,
              },
            }
          );
          await ledgerCol.insertOne({
            userId: referrer._id.toString(),
            username: referrer.username,
            type: 'referral_bonus',
            currency: 'SC',
            amount: commissionSC,
            balanceBefore: referrer.balanceSC || 0,
            balanceAfter: (referrer.balanceSC || 0) + commissionSC,
            performedBy: 'system',
            notes: `50% referral commission from player ${user.username}'s first deposit ($${deposit.amount})`,
            createdAt: new Date(),
          });
        }
      }

      // Send confirmation email
      sendEmail({
        to: user.email,
        subject: `Deposit Confirmed: ${creditedSC} SC credited to your Vegas One wallet!`,
        html: `<p>Hi ${user.username}, your deposit of $${deposit.amount} via ${deposit.methodName} was verified and ${creditedSC} SC (+ ${creditedGC.toLocaleString()} GC) was credited to your account. Best of luck at the tables!</p>`,
      }).catch(() => {});

      return NextResponse.json({ success: true, message: `Deposit approved! Credited ${creditedSC} SC to ${user.username}.` });
    } else if (action === 'reject') {
      await depositsCol.updateOne(
        { _id: deposit._id },
        {
          $set: {
            status: 'rejected',
            rejectReason: rejectReason || 'Payment receipt unverified',
            processedBy: `${session.username} (${session.role})`,
            updatedAt: new Date(),
          },
        }
      );

      return NextResponse.json({ success: true, message: 'Deposit rejected.' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
