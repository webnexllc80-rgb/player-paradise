import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session || (session.role !== ROLES.SUPER_ADMIN && session.role !== ROLES.COIN_MANAGER && session.role !== ROLES.OPERATION_ADMIN)) {
      return NextResponse.json({ success: false, error: 'Unauthorized staff role.' }, { status: 403 });
    }

    const body = await req.json();
    const { targetUser, amountSC, amountGC, actionType, notes } = body;

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'Target user username or email is required.' }, { status: 400 });
    }

    const scVal = parseFloat(amountSC) || 0;
    const gcVal = parseInt(amountGC, 10) || 0;

    if (scVal === 0 && gcVal === 0) {
      return NextResponse.json({ success: false, error: 'Please enter SC or GC amount.' }, { status: 400 });
    }

    const cleanUser = targetUser.trim().toLowerCase();
    const db = await getDb();
    const usersCol = db.collection('users');

    const user = await usersCol.findOne({
      $or: [{ email: cleanUser }, { username: cleanUser }],
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Player account not found.' }, { status: 404 });
    }

    const isCredit = actionType !== 'DEBIT';
    const finalSC = isCredit ? Math.abs(scVal) : -Math.abs(scVal);
    const finalGC = isCredit ? Math.abs(gcVal) : -Math.abs(gcVal);

    // Prevent negative balances on debit
    if (!isCredit) {
      if ((user.balanceSC || 0) + finalSC < 0 || (user.balanceGC || 0) + finalGC < 0) {
        return NextResponse.json({ success: false, error: 'Player does not have sufficient balance for debit.' }, { status: 400 });
      }
    }

    await usersCol.updateOne(
      { _id: user._id },
      {
        $inc: {
          balanceSC: finalSC,
          balanceGC: finalGC,
        },
      }
    );

    // Record in ledger
    const ledgerCol = db.collection('ledger');
    await ledgerCol.insertOne({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      type: isCredit ? 'STAFF_CREDIT' : 'STAFF_DEBIT',
      amountSC: finalSC,
      amountGC: finalGC,
      status: 'COMPLETED',
      notes: notes || `Manual ${isCredit ? 'credit' : 'debit'} by staff member ${session.username}`,
      staffUser: session.username,
      createdAt: new Date(),
    });

    // Notify player
    const notifsCol = db.collection('notifications');
    await notifsCol.insertOne({
      userEmail: user.email,
      title: isCredit ? 'Balance Credited by Staff' : 'Balance Adjusted by Staff',
      message: `Staff adjusted your balance: ${finalSC >= 0 ? '+' : ''}${finalSC} SC, ${finalGC >= 0 ? '+' : ''}${finalGC} GC.`,
      type: isCredit ? 'SUCCESS' : 'INFO',
      read: false,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Successfully adjusted balance for ${user.username}: ${finalSC >= 0 ? '+' : ''}${finalSC} SC, ${finalGC >= 0 ? '+' : ''}${finalGC} GC`,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
