import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, ROLES, getUserFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    const type = searchParams.get('type');
    const format = searchParams.get('format');
    const limit = parseInt(searchParams.get('limit') || '200');

    const db = await getDb();
    const ledgerCol = db.collection('ledger');
    const depositsCol = db.collection('deposits');
    const redemptionsCol = db.collection('redemptions');

    const isStaff =
      session.role === ROLES.SUPER_ADMIN ||
      session.role === ROLES.FINANCIAL_MANAGER ||
      session.role === ROLES.OPERATION_ADMIN ||
      session.role === ROLES.COIN_MANAGER;

    const query = {};
    let userPossibleIds = [];

    if (!isStaff) {
      // Normal player can only see their own records across all possible stored user IDs & username
      userPossibleIds = [String(session.userId)];
      try {
        const uDoc = await db.collection('users').findOne(getUserFilter(session));
        if (uDoc?._id) userPossibleIds.push(uDoc._id.toString());
        if (uDoc?.username) userPossibleIds.push(uDoc.username);
      } catch {}
      if (session.username) userPossibleIds.push(session.username);

      query.$or = [
        { userId: { $in: userPossibleIds } },
        { username: session.username },
      ];
    } else if (username && username.trim()) {
      query.username = { $regex: new RegExp(username.trim(), 'i') };
    }

    if (type && type !== 'all') {
      const t = type.toLowerCase();
      if (t === 'deposit') {
        // Pure deposit only
        query.type = { $regex: /^deposit$|^deposit_base$|^deposit_pending$/i };
      } else if (t === 'withdrawal' || t === 'withdraw' || t === 'redemption' || t === 'cashout') {
        query.type = { $regex: /withdraw|redemption/i };
      } else if (t === 'daily_spin' || t === 'spin') {
        query.type = { $regex: /spin/i };
      } else if (t === 'referral' || t === 'referral_bonus') {
        query.type = { $regex: /referral/i };
      } else if (t === 'bonus') {
        query.type = { $regex: /bonus|promo|welcome|freeplay/i };
      } else if (t === 'adjustment' || t === 'staff') {
        query.type = { $regex: /staff|credit|debit|adjust/i };
      } else {
        query.type = { $regex: new RegExp(`^${type}$`, 'i') };
      }
    }

    const items = await ledgerCol
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    // Cross-reference screenshot proofs
    const depIds = [];
    const withIds = [];
    for (const item of items) {
      if (item.referenceId) {
        const rawId = item.referenceId.toString();
        const t = (item.type || '').toLowerCase();
        let oid = null;
        try {
          if (ObjectId.isValid(rawId)) {
            oid = new ObjectId(rawId);
          }
        } catch {}

        if (oid) {
          if (t.includes('deposit')) {
            depIds.push(oid);
          } else if (t.includes('withdraw') || t.includes('redemption')) {
            withIds.push(oid);
          }
        }
      }
    }

    const depositsMap = {};
    if (depIds.length > 0) {
      const deps = await depositsCol.find({ _id: { $in: depIds } }).toArray();
      deps.forEach((d) => {
        depositsMap[d._id.toString()] = d;
      });
    }

    const redemptionsMap = {};
    if (withIds.length > 0) {
      const reds = await redemptionsCol.find({ _id: { $in: withIds } }).toArray();
      reds.forEach((r) => {
        redemptionsMap[r._id.toString()] = r;
      });
    }

    const records = [];
    for (const r of items) {
      const refId = r.referenceId ? r.referenceId.toString() : null;
      const dep = refId ? depositsMap[refId] : null;
      const red = refId ? redemptionsMap[refId] : null;

      const proofScreenshot =
        r.proofImage ||
        dep?.proofImage ||
        red?.gameScreenshot ||
        red?.qrCodeImage ||
        null;

      const methodName = r.methodName || dep?.methodName || red?.payoutMethod || null;
      const txHash = r.txHash || dep?.txHash || null;
      const status = dep?.status || red?.status || r.status || 'approved';

      const rawT = (r.type || '').toLowerCase();
      const notes = (r.notes || '').toLowerCase();

      // Check if this is a historical deposit that bundled base deposit + bonus together in 1 entry:
      // e.g.: "Deposit $50 approved (100 SC credited: $50 base + 50 SC welcome bonus)..."
      const bonusMatch = notes.match(/\$(\d+(\.\d+)?) base \+ (\d+(\.\d+)?) SC ([\w\s]+) bonus/i);

      if (rawT === 'deposit' && bonusMatch) {
        const baseAmt = parseFloat(bonusMatch[1]);
        const bonusAmt = parseFloat(bonusMatch[3]);
        const bonusTypeLabel = (bonusMatch[5] || 'Welcome').trim();

        // 1. Base Deposit record
        records.push({
          id: `${r._id.toString()}_base`,
          userId: r.userId,
          username: r.username,
          type: 'deposit',
          displayType: 'Deposit',
          rawType: 'deposit',
          currency: r.currency || 'SC',
          amount: baseAmt,
          amountSC: baseAmt,
          amountGC: Number(r.amountGC || 0),
          balanceBefore: r.balanceBefore !== undefined ? Number(r.balanceBefore) : null,
          balanceAfter: r.balanceBefore !== undefined ? Number((Number(r.balanceBefore) + baseAmt).toFixed(2)) : null,
          performedBy: r.performedBy,
          staffRole: r.staffRole || null,
          status,
          notes: `Deposit $${baseAmt.toFixed(2)} approved via ${methodName || 'Payment Gateway'}. TXID: ${txHash || 'N/A'}`,
          createdAt: r.createdAt,
          referenceId: refId,
          proofImage: proofScreenshot,
          methodName,
          txHash,
        });

        // 2. Bonus record
        records.push({
          id: `${r._id.toString()}_bonus`,
          userId: r.userId,
          username: r.username,
          type: bonusTypeLabel.toLowerCase().includes('welcome') ? 'welcome_bonus' : 'deposit_bonus',
          displayType: `${bonusTypeLabel} Bonus`,
          rawType: 'deposit_bonus',
          currency: r.currency || 'SC',
          amount: bonusAmt,
          amountSC: bonusAmt,
          amountGC: 0,
          balanceBefore: r.balanceBefore !== undefined ? Number((Number(r.balanceBefore) + baseAmt).toFixed(2)) : null,
          balanceAfter: r.balanceAfter !== undefined ? Number(r.balanceAfter) : null,
          performedBy: r.performedBy,
          staffRole: r.staffRole || null,
          status: 'approved',
          notes: `${bonusTypeLabel} Bonus: +$${bonusAmt.toFixed(2)} SC credited on deposit ($${baseAmt.toFixed(2)})`,
          createdAt: new Date(new Date(r.createdAt).getTime() + 1000),
          referenceId: refId,
          proofImage: null,
          methodName: null,
          txHash: null,
        });
        continue;
      }

      let normalizedType = 'other';
      let displayType = 'Transaction';

      if (rawT.includes('spin') || notes.includes('lucky spin') || notes.includes('wheel prize') || notes.includes('daily spin')) {
        normalizedType = 'daily_spin_bonus';
        displayType = 'Daily Spin Bonus';
      } else if (rawT.includes('referral') || notes.includes('referral bonus') || notes.includes('referred friend')) {
        normalizedType = 'referral_bonus';
        displayType = 'Referral Bonus';
      } else if (rawT.includes('welcome') || notes.includes('welcome bonus') || notes.includes('sign-up welcome')) {
        normalizedType = 'welcome_bonus';
        displayType = 'Welcome Bonus';
      } else if (rawT.includes('freeplay') || notes.includes('freeplay')) {
        normalizedType = 'freeplay_bonus';
        displayType = 'Freeplay Bonus';
      } else if (rawT.includes('bonus') || rawT.includes('promo') || notes.includes('bonus')) {
        normalizedType = 'bonus';
        displayType = rawT.includes('deposit') ? 'Deposit Bonus' : 'Bonus';
      } else if (rawT.includes('deposit')) {
        normalizedType = 'deposit';
        displayType = 'Deposit';
      } else if (rawT.includes('withdraw') || rawT.includes('redemption')) {
        normalizedType = 'withdrawal';
        displayType = 'Cashout';
      } else if (rawT.includes('credit')) {
        normalizedType = 'adjustment_credit';
        displayType = 'Balance Added';
      } else if (rawT.includes('debit')) {
        normalizedType = 'adjustment_debit';
        displayType = 'Balance Deducted';
      } else if (rawT.includes('load') || rawT.includes('transfer')) {
        normalizedType = 'game_transfer';
        displayType = 'Game Transfer';
      } else {
        displayType = r.type ? r.type.replace(/_/g, ' ') : 'Adjustment';
      }

      const rawAmount = Number(r.amount ?? r.amountSC ?? 0);
      const isDeduction = rawT.includes('withdraw') || rawT.includes('redemption') || rawT.includes('debit');
      const finalAmount = isDeduction ? -Math.abs(rawAmount) : rawAmount;

      records.push({
        id: r._id.toString(),
        userId: r.userId,
        username: r.username,
        type: normalizedType,
        displayType,
        rawType: r.type,
        currency: r.currency || 'USD',
        amount: finalAmount,
        amountSC: finalAmount,
        amountGC: Number(r.amountGC || 0),
        balanceBefore: r.balanceBefore !== undefined ? Number(r.balanceBefore) : null,
        balanceAfter: r.balanceAfter !== undefined ? Number(r.balanceAfter) : null,
        performedBy: r.performedBy,
        staffRole: r.staffRole || null,
        status,
        notes: r.notes || dep?.senderNote || '',
        createdAt: r.createdAt,
        referenceId: refId,
        proofImage: proofScreenshot,
        methodName,
        txHash,
      });
    }

    // Include pending deposits and pending cashouts so players & staff see their live progress!
    const settledRefIds = new Set(records.map((r) => r.referenceId).filter(Boolean));

    // 1. Pending/In-review Deposits
    if (!type || type === 'all' || type.toLowerCase().includes('deposit')) {
      const depQuery = {};
      if (!isStaff) {
        depQuery.$or = [
          { userId: { $in: userPossibleIds } },
          { username: session.username },
        ];
      } else if (username && username.trim()) {
        depQuery.username = { $regex: new RegExp(username.trim(), 'i') };
      }

      const pendingDeps = await depositsCol
        .find(depQuery)
        .sort({ createdAt: -1 })
        .limit(isStaff ? 50 : 20)
        .toArray();

      for (const dep of pendingDeps) {
        const depIdStr = dep._id.toString();
        if (!settledRefIds.has(depIdStr)) {
          records.push({
            id: depIdStr,
            userId: dep.userId,
            username: dep.username,
            type: 'deposit',
            displayType: 'Deposit',
            rawType: 'deposit_pending',
            currency: 'SC',
            amount: Number(dep.amount || 0),
            balanceBefore: null,
            balanceAfter: null,
            performedBy: dep.processedBy || 'Pending Review',
            staffRole: null,
            status: dep.status || 'pending',
            notes: dep.senderNote
              ? `Sender: ${dep.senderNote}`
              : dep.rejectReason
              ? `Rejected: ${dep.rejectReason}`
              : 'Deposit pending verification',
            createdAt: dep.createdAt,
            referenceId: depIdStr,
            proofImage: dep.proofImage || null,
            methodName: dep.methodName || 'Payment Gateway',
            txHash: dep.txHash || null,
          });
        }
      }
    }

    // 2. Pending/In-review Redemptions & Cashouts
    if (
      !type ||
      type === 'all' ||
      type.toLowerCase().includes('redemption') ||
      type.toLowerCase().includes('withdraw') ||
      type.toLowerCase().includes('cashout')
    ) {
      const redQuery = {};
      if (!isStaff) {
        redQuery.$or = [
          { userId: { $in: userPossibleIds } },
          { username: session.username },
        ];
      } else if (username && username.trim()) {
        redQuery.username = { $regex: new RegExp(username.trim(), 'i') };
      }

      const pendingReds = await redemptionsCol
        .find(redQuery)
        .sort({ createdAt: -1 })
        .limit(isStaff ? 50 : 20)
        .toArray();

      for (const red of pendingReds) {
        const redIdStr = red._id.toString();
        if (!settledRefIds.has(redIdStr)) {
          let statusLabel = red.status || 'pending';
          if (red.status === 'pending_coin' || red.stage === 'coin_verification') {
            statusLabel = 'Pending Coin Verification';
          } else if (red.status === 'pending') {
            statusLabel = 'Pending Payout';
          }

          records.push({
            id: redIdStr,
            userId: red.userId,
            username: red.username,
            type: 'withdrawal',
            displayType: 'Cashout',
            rawType: 'withdrawal_pending',
            currency: 'SC',
            amount: -Math.abs(Number(red.amount || 0)),
            balanceBefore: null,
            balanceAfter: null,
            performedBy: red.processedBy || red.coinApprovedBy || 'Pending Review',
            staffRole: null,
            status: statusLabel,
            notes: red.destinationAddress
              ? `Cashout request to: ${red.destinationAddress} (${red.payoutMethod || ''})`
              : red.rejectReason
              ? `Rejected: ${red.rejectReason}`
              : 'Cashout in verification queue',
            createdAt: red.createdAt,
            referenceId: redIdStr,
            proofImage: red.gameScreenshot || red.qrCodeImage || null,
            methodName: red.payoutMethod || 'Payout Gateway',
            txHash: null,
          });
        }
      }
    }

    // Sort combined records by timestamp descending
    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Export CSV if requested
    if (format === 'csv') {
      let csv =
        'ID,Date,Username,Transaction Type,Currency,Amount,Balance Before,Balance After,Auditor / Staff,Status,Notes\n';
      for (const item of records) {
        const row = [
          item.id,
          new Date(item.createdAt).toISOString(),
          item.username,
          item.displayType || item.type,
          item.currency || 'SC',
          item.amount,
          item.balanceBefore ?? '',
          item.balanceAfter ?? '',
          `"${(item.performedBy || 'system').replace(/"/g, '""')}"`,
          `"${(item.status || 'approved').replace(/"/g, '""')}"`,
          `"${(item.notes || '').replace(/"/g, '""')}"`,
        ];
        csv += row.join(',') + '\n';
      }

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="players_paradise_ledger_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        records,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
