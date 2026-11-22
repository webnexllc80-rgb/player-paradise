import { buildStaffInbox } from '@/lib/buildStaffInbox';

function formatAccountRequestRow(r) {
  return {
    id: r._id.toString(),
    userEmail: r.userEmail,
    userName: r.userName || r.userEmail?.split('@')[0],
    gameTitle: r.gameTitle,
    gameId: r.gameId || '',
    requestType: r.requestType || (Number(r.transferAmount || 0) > 0 ? 'COIN_LOAD' : 'ACCOUNT_CREATION'),
    status: r.status || 'PENDING',
    gameAccountUsername: r.gameAccountUsername || '',
    gameAccountPassword: r.gameAccountPassword || '',
    transferAmount: Number(r.transferAmount || 0),
    pendingCoinLoadAmount: Number(r.pendingCoinLoadAmount || 0),
    depositAmount: Number(r.depositAmount || 0),
    bonusSC: Number(r.bonusSC || 0),
    bonusPercent: Number(r.bonusPercent || 0),
    sourceDepositId: r.sourceDepositId || '',
    coinLoadQueued: Boolean(r.coinLoadQueued),
    rejectionReason: r.rejectionReason || r.rejectReason || '',
    freeplayPending: Boolean(r.freeplayPending),
    freeplayAmount: Number(r.freeplayAmount || 0),
    freeplayScreenshot: '',
    hasFreeplayScreenshot: Boolean(r.hasFreeplayScreenshot),
    freeplayTaskId: r.freeplayTaskId || '',
    notes: r.notes || '',
    createdAt: r.createdAt || new Date(),
  };
}

function mapDepositRow(d) {
  const bonusType = d.bonusType || 'welcome';
  const bonusPercent = d.bonusPercent ?? (bonusType === 'welcome' ? 300 : 50);
  const bonusSC = d.bonusSC !== undefined ? d.bonusSC : Number(((d.amount * bonusPercent) / 100).toFixed(2));
  const totalSC = d.totalSC !== undefined ? d.totalSC : Number((d.amount + bonusSC).toFixed(2));
  const totalGC = d.totalGC !== undefined ? d.totalGC : d.amount * 10000;
  const hasProof = d.hasProofImage !== undefined
    ? Boolean(d.hasProofImage)
    : Boolean(d.proofImage || d.proofUrl || d.receiptImage || d.screenshot);

  return {
    id: d._id.toString(),
    userId: d.userId,
    username: d.username,
    amount: d.amount,
    methodName: d.methodName || d.method || 'Payment',
    method: d.method || d.methodName || 'Payment',
    playerTagName: d.playerTagName || d.senderNote || '',
    playerPaymentEmail: d.playerPaymentEmail || '',
    senderNote: d.senderNote || d.playerTagName || '',
    proofImage: hasProof ? `/api/payments/deposit/proof?id=${d._id}` : null,
    hasProof,
    txHash: d.txHash || '',
    bonusType,
    bonusPercent,
    bonusSC,
    totalSC,
    totalGC,
    creditedSC: d.creditedSC || null,
    gameTitle: d.gameTitle || null,
    gameId: d.gameId || null,
    gameAccountUsername: d.gameAccountUsername || null,
    hasGameAccount: Boolean(d.gameAccountUsername),
    status: d.status,
    stage: d.stage || '',
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

function mapRedemptionRow(r) {
  const hasScreenshot = r.hasGameScreenshot !== undefined
    ? Boolean(r.hasGameScreenshot)
    : Boolean(r.gameScreenshot);
  const hasQr = r.hasQrCodeImage !== undefined ? Boolean(r.hasQrCodeImage) : Boolean(r.qrCodeImage);

  return {
    id: r._id.toString(),
    userId: r.userId,
    username: r.username,
    amount: r.amount,
    gameTitle: r.gameTitle || 'Standard Platform',
    gameAccountUsername: r.gameAccountUsername || '',
    gameScreenshot: hasScreenshot ? `/api/payments/withdraw/proof?id=${r._id}&type=gameScreenshot` : null,
    qrCodeImage: hasQr ? `/api/payments/withdraw/proof?id=${r._id}&type=qrCodeImage` : null,
    hasScreenshot,
    hasQrCode: hasQr,
    payoutMethod: r.payoutMethod,
    destinationTag: r.destinationTag || r.destinationAddress || '',
    destinationAddress: r.destinationAddress || r.destinationTag || '',
    status: r.status,
    stage: r.stage || '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** One DB round-trip bundle for admin alerts + queue lists (no HTTP layer cache). */
export async function fetchAdminLiveDeskSnapshot(db) {
  const requestsCol = db.collection('accountRequests');
  const depositsCol = db.collection('deposits');
  const redemptionsCol = db.collection('redemptions');
  const chatCol = db.collection('chat_messages');

  const [accountRequests, deposits, redemptions, conversations] = await Promise.all([
    requestsCol
      .aggregate([
        { $match: {} },
        { $sort: { createdAt: -1 } },
        { $limit: 200 },
        {
          $addFields: {
            hasFreeplayScreenshot: {
              $gt: [
                {
                  $strLenCP: {
                    $ifNull: ['$freeplayScreenshot', { $ifNull: ['$screenshot', ''] }],
                  },
                },
                0,
              ],
            },
          },
        },
        { $project: { freeplayScreenshot: 0, screenshot: 0 } },
      ])
      .toArray(),
    depositsCol
      .aggregate([
        { $match: {} },
        { $sort: { createdAt: -1 } },
        { $limit: 100 },
        {
          $addFields: {
            hasProofImage: {
              $or: [
                { $ne: [{ $ifNull: ['$proofImage', ''] }, ''] },
                { $ne: [{ $ifNull: ['$proofUrl', ''] }, ''] },
                { $ne: [{ $ifNull: ['$receiptImage', ''] }, ''] },
                { $ne: [{ $ifNull: ['$screenshot', ''] }, ''] },
              ],
            },
          },
        },
        { $project: { proofImage: 0, receiptImage: 0, screenshot: 0 } },
      ])
      .toArray(),
    redemptionsCol
      .aggregate([
        { $match: {} },
        { $sort: { createdAt: -1 } },
        { $limit: 100 },
        {
          $addFields: {
            hasGameScreenshot: { $ne: [{ $ifNull: ['$gameScreenshot', ''] }, ''] },
            hasQrCodeImage: { $ne: [{ $ifNull: ['$qrCodeImage', ''] }, ''] },
          },
        },
        { $project: { gameScreenshot: 0, qrCodeImage: 0 } },
      ])
      .toArray(),
    buildStaffInbox(chatCol),
  ]);

  return {
    success: true,
    accountRequests: accountRequests.map((r) => formatAccountRequestRow(r)),
    deposits: deposits.map(mapDepositRow),
    redemptions: redemptions.map(mapRedemptionRow),
    conversations,
  };
}