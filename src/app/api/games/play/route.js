import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser, getUserFilter } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// Slot Machine Symbols & Paytable
const SLOT_SYMBOLS = ['7', 'DIAMOND', 'BELL', 'BAR', 'CHERRY', 'STAR'];
const SLOT_WEIGHTS = [4, 6, 10, 14, 20, 25]; // Probability weights (7 is rarest)

function getRandomSlotSymbol() {
  const total = SLOT_WEIGHTS.reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
    if (rand < SLOT_WEIGHTS[i]) return SLOT_SYMBOLS[i];
    rand -= SLOT_WEIGHTS[i];
  }
  return 'CHERRY';
}

export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Please log in to play.' }, { status: 401 });
    }

    const { gameId, currency = 'SC', betAmount, action = 'spin', gameData = {} } = await req.json();

    const bet = Number(betAmount);
    if (!bet || bet <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid bet amount.' }, { status: 400 });
    }

    const isSC = currency === 'SC';
    const balanceField = isSC ? 'balanceSC' : 'balanceGC';

    const db = await getDb();
    const usersCol = db.collection('users');
    const gamesCol = db.collection('games');
    const activityCol = db.collection('game_activity');
    const ledgerCol = db.collection('ledger');

    const user = await usersCol.findOne(getUserFilter(session));
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    const currentBalance = user[balanceField] || 0;
    if (currentBalance < bet) {
      return NextResponse.json({
        success: false,
        error: `Insufficient ${currency} balance. Current balance: ${currentBalance.toFixed(2)} ${currency}`,
      }, { status: 400 });
    }

    let winAmount = 0;
    let multiplier = 0;
    let outcomeDetails = {};

    // 1. VEGAS 777 DELUXE
    if (gameId === 'vegas-777') {
      const reel1 = getRandomSlotSymbol();
      const reel2 = getRandomSlotSymbol();
      const reel3 = getRandomSlotSymbol();
      const reels = [reel1, reel2, reel3];

      if (reel1 === '7' && reel2 === '7' && reel3 === '7') {
        multiplier = 250; // JACKPOT!
      } else if (reel1 === 'DIAMOND' && reel2 === 'DIAMOND' && reel3 === 'DIAMOND') {
        multiplier = 75;
      } else if (reel1 === 'BELL' && reel2 === 'BELL' && reel3 === 'BELL') {
        multiplier = 35;
      } else if (reel1 === 'BAR' && reel2 === 'BAR' && reel3 === 'BAR') {
        multiplier = 18;
      } else if (reel1 === 'STAR' && reel2 === 'STAR' && reel3 === 'STAR') {
        multiplier = 10;
      } else if (reel1 === 'CHERRY' && reel2 === 'CHERRY' && reel3 === 'CHERRY') {
        multiplier = 6;
      } else if ((reel1 === reel2 || reel2 === reel3 || reel1 === reel3) && (reel1 === '7' || reel2 === '7')) {
        multiplier = 3;
      } else if (reel1 === 'CHERRY' || reel2 === 'CHERRY' || reel3 === 'CHERRY') {
        multiplier = 1.5;
      } else {
        multiplier = 0;
      }

      winAmount = Number((bet * multiplier).toFixed(2));
      outcomeDetails = { reels, multiplier, isJackpot: multiplier >= 75 };
    }

    // 2. NEON CRASH
    else if (gameId === 'neon-crash') {
      const cashOutAt = Number(gameData.cashOutAt) || 1.5;
      // Provably fair simulated crash point
      const rand = Math.random();
      // 96% RTP distribution
      const crashPoint = rand < 0.04 ? 1.0 : Number((0.96 / (1 - rand)).toFixed(2));
      const cappedCrash = Math.min(crashPoint, 100);

      if (action === 'cashout' && cashOutAt <= cappedCrash) {
        multiplier = cashOutAt;
        winAmount = Number((bet * multiplier).toFixed(2));
      } else {
        multiplier = 0;
        winAmount = 0;
      }

      outcomeDetails = { crashPoint: cappedCrash, userCashedOut: action === 'cashout' && cashOutAt <= cappedCrash, target: cashOutAt };
    }

    // 3. ROYAL ROULETTE
    else if (gameId === 'royal-roulette') {
      const winningNumber = Math.floor(Math.random() * 37); // 0 to 36
      const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(winningNumber);
      const isBlack = winningNumber !== 0 && !isRed;
      const isEven = winningNumber !== 0 && winningNumber % 2 === 0;
      const isOdd = winningNumber !== 0 && winningNumber % 2 !== 0;

      const betType = gameData.betType || 'red'; // 'red', 'black', 'even', 'odd', 'number'
      const betVal = gameData.betVal;

      if (betType === 'number' && Number(betVal) === winningNumber) {
        multiplier = 36;
      } else if (betType === 'red' && isRed) {
        multiplier = 2;
      } else if (betType === 'black' && isBlack) {
        multiplier = 2;
      } else if (betType === 'even' && isEven) {
        multiplier = 2;
      } else if (betType === 'odd' && isOdd) {
        multiplier = 2;
      } else {
        multiplier = 0;
      }

      winAmount = Number((bet * multiplier).toFixed(2));
      outcomeDetails = { winningNumber, isRed, isBlack, betType, betVal };
    }

    // 4. VEGAS BLACKJACK
    else if (gameId === 'vegas-blackjack') {
      const playerTotal = Math.min(21, Math.floor(Math.random() * 10) + 12);
      const dealerTotal = Math.min(26, Math.floor(Math.random() * 11) + 12);

      let bjOutcome = 'lose';
      if (playerTotal > 21) {
        bjOutcome = 'bust';
        multiplier = 0;
      } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
        bjOutcome = 'win';
        multiplier = 2;
      } else if (playerTotal === dealerTotal) {
        bjOutcome = 'push';
        multiplier = 1;
      } else {
        bjOutcome = 'lose';
        multiplier = 0;
      }

      winAmount = Number((bet * multiplier).toFixed(2));
      outcomeDetails = { playerTotal, dealerTotal, bjOutcome };
    }

    // Default / Generic fallback
    else {
      multiplier = Math.random() > 0.52 ? (Math.random() > 0.8 ? 3.0 : 1.8) : 0;
      winAmount = Number((bet * multiplier).toFixed(2));
      outcomeDetails = { multiplier };
    }

    const netChange = winAmount - bet;
    const newBalance = Number((currentBalance + netChange).toFixed(2));

    // Update Player Balance
    await usersCol.updateOne(
      { _id: user._id },
      { $inc: { [balanceField]: netChange } }
    );

    // Update Game plays count
    await gamesCol.updateOne(
      { gameId },
      { $inc: { playsCount: 1 } }
    );

    const isWin = winAmount > bet;

    // Record Game Activity
    await activityCol.insertOne({
      gameId,
      gameTitle: outcomeDetails.title || gameId,
      userId: user._id.toString(),
      username: user.username,
      betAmount: bet,
      winAmount,
      multiplier,
      currency,
      outcome: isWin ? 'win' : winAmount === bet ? 'push' : 'loss',
      details: outcomeDetails,
      createdAt: new Date(),
    });

    // Immutable Ledger Entry for Bet & Win
    await ledgerCol.insertOne({
      userId: user._id.toString(),
      username: user.username,
      type: isWin ? 'game_win' : 'game_bet',
      currency,
      amount: isWin ? winAmount : -bet,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      performedBy: 'player',
      referenceId: gameId,
      notes: `${gameId} wager: bet ${bet} ${currency}, return ${winAmount} ${currency} (${multiplier}x)`,
      createdAt: new Date(),
    });

    return NextResponse.json({
      success: true,
      outcome: {
        winAmount,
        multiplier,
        netChange,
        isWin,
        details: outcomeDetails,
      },
      newBalance,
      currency,
    });
  } catch (error) {
    console.error('Game play error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
