import { ObjectId } from 'mongodb';

/**
 * Helper to safely match an email or username with regex
 */
function makeCaseInsensitiveRegex(str) {
  if (!str) return null;
  return new RegExp(`^${str.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
}

/**
 * Check if a player already has an approved/ready game account for a given gameTitle
 */
export async function findUserGameAccount(db, { userId, userEmail, username }, gameTitle) {
  if (!db || !gameTitle) return { exists: false, username: '' };

  const cleanGame = String(gameTitle).trim();
  const gameRegex = makeCaseInsensitiveRegex(cleanGame);

  const userConditions = [];
  if (userEmail) {
    userConditions.push({ userEmail: makeCaseInsensitiveRegex(userEmail) });
    userConditions.push({ email: makeCaseInsensitiveRegex(userEmail) });
  }
  if (username) {
    userConditions.push({ username: makeCaseInsensitiveRegex(username) });
    userConditions.push({ userName: makeCaseInsensitiveRegex(username) });
  }
  if (userId) {
    userConditions.push({ userId: String(userId) });
    if (ObjectId.isValid(userId)) {
      userConditions.push({ userId: new ObjectId(userId) });
    }
  }

  if (userConditions.length === 0) {
    return { exists: false, username: '' };
  }

  const query = {
    $and: [
      { $or: userConditions },
      {
        $or: [
          { gameTitle: gameRegex },
          { gameTitle: cleanGame },
          { gameId: cleanGame.toLowerCase().replace(/\s+/g, '-') },
        ],
      },
      { status: 'READY' },
    ],
  };

  // 1. Check verified gameAccounts collection
  const gameAccount = await db.collection('gameAccounts').findOne(query);
  if (gameAccount && (gameAccount.username || gameAccount.gameAccountUsername)) {
    return {
      exists: true,
      username: gameAccount.username || gameAccount.gameAccountUsername || '',
      gameTitle: gameAccount.gameTitle || cleanGame,
      account: gameAccount,
    };
  }

  // 2. Fallback: Check READY accountRequests
  const readyRequest = await db.collection('accountRequests').findOne(query);
  if (readyRequest && (readyRequest.gameAccountUsername || readyRequest.username)) {
    return {
      exists: true,
      username: readyRequest.gameAccountUsername || readyRequest.username || '',
      gameTitle: readyRequest.gameTitle || cleanGame,
      account: readyRequest,
    };
  }

  return { exists: false, username: '' };
}

/**
 * Fetch all verified game accounts for a player
 */
export async function getUserGameAccountsList(db, { userId, userEmail, username }) {
  if (!db) return [];

  const userConditions = [];
  if (userEmail) {
    userConditions.push({ userEmail: makeCaseInsensitiveRegex(userEmail) });
    userConditions.push({ email: makeCaseInsensitiveRegex(userEmail) });
  }
  if (username) {
    userConditions.push({ username: makeCaseInsensitiveRegex(username) });
    userConditions.push({ userName: makeCaseInsensitiveRegex(username) });
  }
  if (userId) {
    userConditions.push({ userId: String(userId) });
    if (ObjectId.isValid(userId)) {
      userConditions.push({ userId: new ObjectId(userId) });
    }
  }

  if (userConditions.length === 0) return [];

  const query = {
    $or: userConditions,
    status: 'READY',
  };

  const [accounts, readyRequests] = await Promise.all([
    db.collection('gameAccounts').find(query).toArray(),
    db.collection('accountRequests').find(query).toArray(),
  ]);

  const map = new Map();
  accounts.forEach((acc) => {
    const key = (acc.gameTitle || '').toLowerCase().trim();
    if (key && !map.has(key)) {
      map.set(key, {
        gameTitle: acc.gameTitle,
        username: acc.username || acc.gameAccountUsername,
        id: acc._id ? acc._id.toString() : acc.id,
      });
    }
  });

  readyRequests.forEach((req) => {
    const key = (req.gameTitle || '').toLowerCase().trim();
    if (key && !map.has(key)) {
      map.set(key, {
        gameTitle: req.gameTitle,
        username: req.gameAccountUsername || req.username,
        id: req._id ? req._id.toString() : req.id,
      });
    }
  });

  return Array.from(map.values());
}
