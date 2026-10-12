import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';

// Symbols for Panda 777 Cyber Slots
const SLOT_SYMBOLS = [
  { id: 'panda', name: 'Cyber Panda Wild', multiplier: 25, icon: '🐼', weight: 8 },
  { id: 'seven', name: 'Neon 777', multiplier: 15, icon: '7️⃣', weight: 12 },
  { id: 'diamond', name: 'Cyber Diamond', multiplier: 10, icon: '💎', weight: 16 },
  { id: 'bell', name: 'Golden Bell', multiplier: 5, icon: '🔔', weight: 24 },
  { id: 'lightning', name: 'Neon Bolt', multiplier: 3, icon: '⚡', weight: 30 },
  { id: 'cherry', name: 'Cyber Cherry', multiplier: 2, icon: '🍒', weight: 40 },
];

function spinReel() {
  const totalWeight = SLOT_SYMBOLS.reduce((acc, s) => acc + s.weight, 0);
  let rand = Math.random() * totalWeight;
  for (const sym of SLOT_SYMBOLS) {
    if (rand < sym.weight) return sym;
    rand -= sym.weight;
  }
  return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1];
}

export async function POST(req) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Please log in to play.' }, { status: 401 });
    }

    const body = await req.json();
    const { gameType, currency = 'SC', betAmount = 1, options = {} } = body;

    const bet = parseFloat(betAmount);
    if (!bet || bet <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid bet amount.' }, { status: 400 });
    }

    const isSC = currency === 'SC';
    const db = await getDb();
    const usersCol = db.collection('users');

    let userFilter = { _id: session.userId };
    if (ObjectId.isValid(session.userId)) {
      userFilter = { _id: new ObjectId(session.userId) };
    }

    let user = await usersCol.findOne(userFilter);
    if (!user) {
      user = await usersCol.findOne({ email: session.email });
    }

    if (!user) {
      return NextResponse.json({ success: false, message: 'User account not found.' }, { status: 404 });
    }

    const currentBalance = isSC ? (user.balanceSC || 0) : (user.balanceGC || 0);
    if (currentBalance < bet) {
      return NextResponse.json(
        { success: false, message: `Insufficient ${currency} balance. Current balance: ${currentBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    let winAmount = 0;
    let resultData = {};

    // 1. PANDA 777 SLOTS
    if (gameType === 'slots' || gameType === 'panda-777-slots') {
      const reel1 = spinReel();
      const reel2 = spinReel();
      const reel3 = spinReel();

      let isWin = false;
      let multiplier = 0;

      if (reel1.id === reel2.id && reel2.id === reel3.id) {
        isWin = true;
        multiplier = reel1.multiplier;
      } else if (reel1.id === 'panda' || reel2.id === 'panda' || reel3.id === 'panda') {
        // Wild hit
        const nonWilds = [reel1, reel2, reel3].filter((r) => r.id !== 'panda');
        if (nonWilds.length <= 1 || (nonWilds.length === 2 && nonWilds[0].id === nonWilds[1].id)) {
          isWin = true;
          multiplier = (nonWilds[0]?.multiplier || 25) * 0.8;
        } else {
          isWin = true;
          multiplier = 1.5;
        }
      } else if (reel1.id === reel2.id || reel2.id === reel3.id || reel1.id === reel3.id) {
        // Two match
        isWin = true;
        multiplier = 1.2;
      }

      winAmount = isWin ? bet * multiplier : 0;
      resultData = {
        reels: [reel1, reel2, reel3],
        multiplier: Math.round(multiplier * 100) / 100,
        isWin,
        isJackpot: reel1.id === 'panda' && reel2.id === 'panda' && reel3.id === 'panda',
      };
    }

    // 2. CYBER MATRIX CRASH
    else if (gameType === 'crash' || gameType === 'cyber-matrix-crash') {
      const playerCashoutMultiplier = parseFloat(options.cashoutMultiplier || 1.5);
      // Realistic crash distribution
      const e = 2 ** 32;
      const h = Math.floor(Math.random() * e);
      const crashPoint = Math.max(1.0, Math.floor((100 * e - h) / (e - h)) / 100);

      const didCashout = playerCashoutMultiplier <= crashPoint;
      winAmount = didCashout ? bet * playerCashoutMultiplier : 0;

      resultData = {
        crashPoint,
        playerCashout: playerCashoutMultiplier,
        isWin: didCashout,
        multiplier: didCashout ? playerCashoutMultiplier : 0,
      };
    }

    // 3. CYBER NEON BLACKJACK
    else if (gameType === 'blackjack' || gameType === 'cyber-blackjack') {
      const playerCards = [
        Math.min(10, Math.floor(Math.random() * 11) + 1),
        Math.min(10, Math.floor(Math.random() * 11) + 1),
      ];
      const dealerCards = [
        Math.min(10, Math.floor(Math.random() * 11) + 1),
        Math.min(10, Math.floor(Math.random() * 11) + 1),
      ];

      const playerTotal = playerCards.reduce((a, b) => a + b, 0);
      const dealerTotal = dealerCards.reduce((a, b) => a + b, 0);

      let isWin = false;
      let isPush = false;

      if (playerTotal === 21 && playerCards.length === 2) {
        isWin = true;
        winAmount = bet * 2.5; // Blackjack 3:2
      } else if (playerTotal > 21) {
        isWin = false;
        winAmount = 0;
      } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
        isWin = true;
        winAmount = bet * 2.0;
      } else if (playerTotal === dealerTotal) {
        isPush = true;
        winAmount = bet;
      } else {
        isWin = false;
        winAmount = 0;
      }

      resultData = {
        playerCards,
        dealerCards,
        playerTotal,
        dealerTotal,
        isWin,
        isPush,
      };
    }

    // 4. NEON CYBER ROULETTE
    else if (gameType === 'roulette' || gameType === 'neon-roulette') {
      const winningNumber = Math.floor(Math.random() * 37); // 0-36
      const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(winningNumber);
      const isBlack = winningNumber !== 0 && !isRed;

      const betChoice = options.betChoice || 'red'; // 'red', 'black', 'even', 'odd', or exact number
      let isWin = false;
      let multiplier = 0;

      if (betChoice === 'red' && isRed) {
        isWin = true;
        multiplier = 2.0;
      } else if (betChoice === 'black' && isBlack) {
        isWin = true;
        multiplier = 2.0;
      } else if (betChoice === 'even' && winningNumber !== 0 && winningNumber % 2 === 0) {
        isWin = true;
        multiplier = 2.0;
      } else if (betChoice === 'odd' && winningNumber % 2 !== 0) {
        isWin = true;
        multiplier = 2.0;
      } else if (parseInt(betChoice, 10) === winningNumber) {
        isWin = true;
        multiplier = 36.0;
      }

      winAmount = isWin ? bet * multiplier : 0;
      resultData = {
        winningNumber,
        color: winningNumber === 0 ? 'green' : isRed ? 'red' : 'black',
        betChoice,
        isWin,
        multiplier,
      };
    }

    const netChange = winAmount - bet;

    // Update user balance in database
    const incObj = isSC ? { balanceSC: netChange } : { balanceGC: netChange };
    await usersCol.updateOne(userFilter, { $inc: incObj });

    const updatedUser = await usersCol.findOne(userFilter);
    const newBalance = isSC ? updatedUser.balanceSC : updatedUser.balanceGC;

    // Record big wins in public activity
    if (winAmount >= bet * 2 && isSC) {
      const activityCol = db.collection('activity');
      await activityCol.insertOne({
        username: user.username,
        gameTitle: gameType,
        amount: winAmount,
        currency: 'SC',
        createdAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      winAmount: Math.round(winAmount * 100) / 100,
      netChange: Math.round(netChange * 100) / 100,
      newBalance: Math.round(newBalance * 100) / 100,
      currency,
      result: resultData,
    });
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
