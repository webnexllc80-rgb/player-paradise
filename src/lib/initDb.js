import bcrypt from 'bcryptjs';
import { getDb } from './mongodb';
import { ROLES } from './auth';

export async function ensureDbInitialized() {
  try {
    const db = await getDb();

    // 1. Ensure Super Admin and Staff accounts
    const usersCol = db.collection('users');
    const existingAdmin = await usersCol.findOne({ role: ROLES.SUPER_ADMIN });

    if (!existingAdmin) {
      console.log('Seeding initial administrators and staff for Players Paradise Hub...');
      const adminPasswordHash = await bcrypt.hash('Paradise@2026!', 10);
      const staffPasswordHash = await bcrypt.hash('Staff@2026!', 10);
      const playerPasswordHash = await bcrypt.hash('Player@2026!', 10);

      await usersCol.insertMany([
        {
          username: 'superadmin',
          email: 'admin@playersparadisehub.com',
          passwordHash: adminPasswordHash,
          role: ROLES.SUPER_ADMIN,
          balanceSC: 50000.0,
          balanceGC: 10000000,
          kycStatus: 'approved',
          vipTier: 'Paradise Legend',
          createdAt: new Date(),
        },
        {
          username: 'financemanager',
          email: 'finance@playersparadisehub.com',
          passwordHash: staffPasswordHash,
          role: ROLES.FINANCIAL_MANAGER,
          balanceSC: 5000.0,
          balanceGC: 500000,
          kycStatus: 'approved',
          vipTier: 'Diamond Elite',
          createdAt: new Date(),
        },
        {
          username: 'coinmanager',
          email: 'coins@playersparadisehub.com',
          passwordHash: staffPasswordHash,
          role: ROLES.COIN_MANAGER,
          balanceSC: 2500.0,
          balanceGC: 250000,
          kycStatus: 'approved',
          vipTier: 'Gold Titan',
          createdAt: new Date(),
        },
        {
          username: 'chatsupport',
          email: 'support@playersparadisehub.com',
          passwordHash: staffPasswordHash,
          role: ROLES.CHAT_SUPPORT,
          balanceSC: 1000.0,
          balanceGC: 100000,
          kycStatus: 'approved',
          vipTier: 'Silver Cyber',
          createdAt: new Date(),
        },
        {
          username: 'demo_player',
          email: 'player@demo.com',
          passwordHash: playerPasswordHash,
          role: ROLES.PLAYER,
          balanceSC: 550.0,
          balanceGC: 125000,
          kycStatus: 'approved',
          vipTier: 'Gold Titan',
          createdAt: new Date(),
        },
      ]);
    }

    // 2. Ensure Games catalog
    const gamesCol = db.collection('games');
    const existingGamesCount = await gamesCol.countDocuments({});

    if (existingGamesCount === 0) {
      console.log('Seeding curated games catalog for Players Paradise Hub...');
      const defaultGames = [
        {
          id: 'panda-777-slots',
          title: 'Panda 777 Cyber Slots',
          category: 'slots',
          isInternal: true,
          rtp: 98.4,
          volatility: 'Medium-High',
          rating: 4.9,
          badge: 'HOT MASCOT',
          image: '/images/games/panda-slots.png',
          fallbackImage: '/images/vegas-777.svg',
          description: 'Spin the reels with the Cyber Panda mascot! Neon wild multipliers, scatter bonuses, and massive cyber jackpots.',
          minBet: 1,
          maxBet: 100,
          jackpot: 125000,
          active: true,
          priority: 1,
        },
        {
          id: 'cyber-matrix-crash',
          title: 'Cyber Matrix Crash',
          category: 'crash',
          isInternal: true,
          rtp: 99.0,
          volatility: 'Dynamic',
          rating: 4.95,
          badge: 'FEATURED',
          image: '/images/neon-crash.svg',
          description: 'Rocket through the cyber matrix! Multiply your credits up to 1000x and cash out before the quantum breach!',
          minBet: 0.5,
          maxBet: 500,
          active: true,
          priority: 2,
        },
        {
          id: 'ultra-panda',
          title: 'Ultra Panda',
          category: 'sweeps',
          isInternal: false,
          platform: 'Ultra Panda Web',
          playUrl: 'https://ultrapanda.mobi',
          rtp: 97.8,
          rating: 4.9,
          badge: 'TOP CHOICE',
          image: '/images/ultra-panda.svg',
          description: 'The legendary Ultra Panda platform. High-octane fish games, slot machines, and community jackpots.',
          active: true,
          priority: 3,
        },
        {
          id: 'fire-kirin',
          title: 'Fire Kirin',
          category: 'fish',
          isInternal: false,
          platform: 'Fire Kirin App',
          playUrl: 'http://firekirin.xyz:8580',
          rtp: 97.5,
          rating: 4.88,
          badge: 'FISH KING',
          image: '/images/fire-kirin.svg',
          description: 'Classic arcade fish table action with boss dragons, lightning cannons, and massive multi-kills.',
          active: true,
          priority: 4,
        },
        {
          id: 'orion-stars',
          title: 'Orion Stars',
          category: 'sweeps',
          isInternal: false,
          platform: 'Orion Stars Web',
          playUrl: 'http://orionstars.vip:8580',
          rtp: 98.1,
          rating: 4.92,
          badge: 'POPULAR',
          image: '/images/orion-stars.svg',
          description: 'The golden standard in online sweeps reels, fish tables, and keno games.',
          active: true,
          priority: 5,
        },
        {
          id: 'game-vault',
          title: 'Game Vault 999',
          category: 'sweeps',
          isInternal: false,
          platform: 'Game Vault',
          playUrl: 'https://download.gamevault999.com',
          rtp: 97.6,
          rating: 4.85,
          badge: 'HIGH PAYOUT',
          image: '/images/game-vault.svg',
          description: 'Top-tier graphics and explosive bonus rounds with thousands of concurrent players.',
          active: true,
          priority: 6,
        },
        {
          id: 'milky-way',
          title: 'Milky Way',
          category: 'sweeps',
          isInternal: false,
          platform: 'Milky Way App',
          playUrl: 'http://milkywayapp.xyz',
          rtp: 97.4,
          rating: 4.8,
          badge: 'TRENDING',
          image: '/images/milky-way.svg',
          description: 'Stellar slot adventures and cosmic fish hunting tables.',
          active: true,
          priority: 7,
        },
        {
          id: 'juwa-777',
          title: 'Juwa 777',
          category: 'slots',
          isInternal: false,
          platform: 'Juwa Online',
          playUrl: 'https://m.juwa777.com',
          rtp: 97.9,
          rating: 4.86,
          badge: 'CLASSIC',
          image: '/images/juwa-777.svg',
          description: 'Exciting fast-paced sweeps with high volatility and instant features.',
          active: true,
          priority: 8,
        },
        {
          id: 'cyber-blackjack',
          title: 'Cyber Neon Blackjack',
          category: 'table',
          isInternal: true,
          rtp: 99.5,
          rating: 4.9,
          badge: 'TABLE VIP',
          image: '/images/vegas-blackjack.svg',
          description: 'High-stakes cyber blackjack table. Blackjack pays 3:2, dealer stands on 17.',
          minBet: 5,
          maxBet: 500,
          active: true,
          priority: 9,
        },
        {
          id: 'neon-roulette',
          title: 'Neon Cyber Roulette',
          category: 'table',
          isInternal: true,
          rtp: 97.3,
          rating: 4.85,
          badge: 'CASINO ROYAL',
          image: '/images/royal-roulette.svg',
          description: 'Glowing futuristic roulette wheel with straight bets, colors, dozens, and cyber audio.',
          minBet: 1,
          maxBet: 250,
          active: true,
          priority: 10,
        },
      ];

      await gamesCol.insertMany(defaultGames);
    }

    // 3. Ensure Default Payment Methods
    const methodsCol = db.collection('paymentMethods');
    const existingMethodsCount = await methodsCol.countDocuments({});

    if (existingMethodsCount === 0) {
      console.log('Seeding initial payment gateways for Players Paradise Hub...');
      const defaultMethods = [
        {
          methodId: 'cashapp',
          name: 'Cash App',
          icon: 'DollarSign',
          tag: '$PlayersParadiseHub',
          displayName: 'Cash App Pay',
          qrCodeUrl: '/images/qr-cashapp.png',
          instructions: 'Send payment with your player username in the note. Instant auto-credit upon verification.',
          minDeposit: 10,
          maxDeposit: 5000,
          minWithdrawal: 25,
          maxWithdrawal: 3000,
          active: true,
          badge: 'MOST POPULAR (INSTANT)',
        },
        {
          methodId: 'zelle',
          name: 'Zelle',
          icon: 'Zap',
          tag: 'pay@playersparadisehub.com',
          displayName: 'Zelle Direct',
          instructions: 'Send via Zelle to pay@playersparadisehub.com. Zero fees, instant bank settlement.',
          minDeposit: 20,
          maxDeposit: 5000,
          minWithdrawal: 50,
          maxWithdrawal: 4000,
          active: true,
          badge: 'ZERO FEES',
        },
        {
          methodId: 'chime',
          name: 'Chime',
          icon: 'CreditCard',
          tag: '$PlayersParadise',
          displayName: 'Chime Spot',
          instructions: 'Send Chime to $PlayersParadise. Include your username.',
          minDeposit: 10,
          maxDeposit: 2500,
          minWithdrawal: 25,
          maxWithdrawal: 2500,
          active: true,
          badge: 'FAST CASHOUT',
        },
        {
          methodId: 'crypto',
          name: 'Bitcoin / USDT',
          icon: 'Bitcoin',
          tag: '1ParadiseHubCyberWalletBTC777',
          displayName: 'Crypto / BTC / USDT (TRC20)',
          instructions: 'Transfer BTC or USDT. Payouts processed within 5-15 minutes.',
          minDeposit: 20,
          maxDeposit: 10000,
          minWithdrawal: 50,
          maxWithdrawal: 10000,
          active: true,
          badge: '10% EXTRA BONUS',
        },
        {
          methodId: 'applepay',
          name: 'Apple Pay / Card',
          icon: 'Smartphone',
          tag: 'apple@playersparadisehub.com',
          displayName: 'Apple Pay',
          instructions: 'Use Apple Pay via SMS or iMessage request for fast deposit.',
          minDeposit: 15,
          maxDeposit: 2000,
          minWithdrawal: 25,
          maxWithdrawal: 2000,
          active: true,
          badge: '1-TAP PAY',
        },
      ];

      await methodsCol.insertMany(defaultMethods);
    }

    console.log('Database initialization check completed successfully.');
  } catch (err) {
    console.error('Error during database initialization:', err);
  }
}
