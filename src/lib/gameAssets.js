/**
 * Instant static thumbnail lookup table for all games.
 * Avoids any delay or waiting for database/network queries.
 */
export const GAME_THUMBNAIL_MAP = {
  'panda master': '/images/games/panda-master.webp',
  'panda-master': '/images/games/panda-master.webp',
  'ultra panda': '/images/games/ultra-panda.webp',
  'ultra-panda': '/images/games/ultra-panda.webp',
  'fire kirin': '/images/games/fire-kirin.webp',
  'fire-kirin': '/images/games/fire-kirin.webp',
  'orion stars': '/images/games/orion-stars.webp',
  'orion-stars': '/images/games/orion-stars.webp',
  'milky way': '/images/games/milky-way.webp',
  'milky-way': '/images/games/milky-way.webp',
  'dragon fury': '/images/games/dragon-fury.webp',
  'dragon-fury': '/images/games/dragon-fury.webp',
  'cash machine': '/images/games/cash-machine.webp',
  'cash-machine': '/images/games/cash-machine.webp',
  'ultra thunder': '/images/games/ultra-thunder.webp',
  'ultra-thunder': '/images/games/ultra-thunder.webp',
  'e-game': '/images/games/e-game.webp',
  'egame': '/images/games/e-game.webp',
  'egames': '/images/games/e-game.webp',
  'game room': '/images/games/game-room.webp',
  'game-room': '/images/games/game-room.webp',
  'mega spin': '/images/games/mega-spin.webp',
  'mega-spin': '/images/games/mega-spin.webp',
  'juwa city': '/images/games/juwa-city.webp',
  'juwa-city': '/images/games/juwa-city.webp',
  'juwa 2.0': '/images/games/juwa-20.webp',
  'juwa 2': '/images/games/juwa-20.webp',
  'juwa-2': '/images/games/juwa-20.webp',
  'juwa': '/images/games/juwa-city.webp',
  'juwa 777': '/images/juwa-777.webp',
  'juwa-777': '/images/juwa-777.webp',
  'game vault': '/images/games/game-vault.webp',
  'game-vault': '/images/games/game-vault.webp',
  'cash frenzy': '/images/games/cash-frenzy.webp',
  'cash-frenzy': '/images/games/cash-frenzy.webp',
  'golden treasure': '/images/games/golden-treasure.webp',
  'golden-treasure': '/images/games/golden-treasure.webp',
  'mr all in one': '/images/games/mr-all-in-one.webp',
  'mr. all-in-one': '/images/games/mr-all-in-one.webp',
  'fun station slots': '/images/games/fun-station-slots.webp',
  'fun-station slots': '/images/games/fun-station-slots.webp',
  'river sweeps': '/images/games/river-sweeps.webp',
  'river-sweeps': '/images/games/river-sweeps.webp',
  'yolo 777': '/images/games/yolo-777.webp',
  'yolo-777': '/images/games/yolo-777.webp',
  'ding ding': '/images/games/ding-ding.webp',
  'ding-ding': '/images/games/ding-ding.webp',
  'vblink': '/images/games/vblink.webp',
  'v-blink': '/images/games/vblink.webp',
  'golden dragon': '/images/games/dragon-fury.webp',
  'golden-dragon': '/images/games/dragon-fury.webp',
  'panda 777 slots': '/images/hero-slot.webp',
  'cyber matrix crash': '/images/neon-crash.webp',
  'royal roulette': '/images/royal-roulette.webp',
  'vegas blackjack': '/images/vegas-blackjack.webp',
  'vegas 777': '/images/vegas-777.webp',
  'vegas-777': '/images/vegas-777.webp',
  'vegas keno': '/images/vegas-keno.webp',
};

/**
 * Returns an instant WebP thumbnail path for any game title/name.
 * If fallback or database thumbnail is provided, it prioritizes the static high-speed WebP asset.
 */
export function getGameThumbnail(titleOrName, fallback) {
  if (!titleOrName) return fallback || '/images/vegas-777.webp';
  const clean = String(titleOrName).toLowerCase().trim();

  // 1. Direct match
  if (GAME_THUMBNAIL_MAP[clean]) {
    return GAME_THUMBNAIL_MAP[clean];
  }

  // 2. Normalized match (remove special chars)
  const normalized = clean.replace(/[^a-z0-9]+/g, ' ').trim();
  if (GAME_THUMBNAIL_MAP[normalized]) {
    return GAME_THUMBNAIL_MAP[normalized];
  }

  // 3. Partial substring match
  for (const [key, path] of Object.entries(GAME_THUMBNAIL_MAP)) {
    if (clean.includes(key) || key.includes(clean)) {
      return path;
    }
  }

  // 4. Return fallback if provided and valid URL (not base64)
  if (fallback && !fallback.startsWith('data:image')) {
    return fallback;
  }

  return '/images/vegas-777.webp';
}

/**
 * Standard list of all major game platforms available in the system.
 */
export const ALL_PLATFORM_GAMES = [
  'Ultra Panda',
  'Panda Master',
  'Fire Kirin',
  'Orion Stars',
  'Milky Way',
  'Game Vault',
  'Juwa City',
  'Juwa 2.0',
  'Dragon Fury',
  'Cash Machine',
  'Ultra Thunder',
  'E-Game',
  'Game Room',
  'Mega Spin',
  'Cash Frenzy',
  'Golden Treasure',
  'Mr. All-In-One',
  'Fun-Station Slots',
  'River Sweeps',
  'Yolo 777',
  'Ding Ding',
  'Vblink',
  'Panda 777 Slots',
  'Cyber Matrix Crash',
];

/**
 * Merges games from Admin, player's active accounts, and standard platforms.
 * Sorts them so player's linked active accounts appear first.
 */
export function getAvailableGamePlatforms(adminGames = [], userAccounts = []) {
  const map = new Map();

  // 1. First add admin games
  (adminGames || []).forEach((g) => {
    const title = (typeof g === 'string' ? g : g?.title || g?.name || '').trim();
    if (title) map.set(title.toLowerCase(), title);
  });

  // 2. Add user account games
  (userAccounts || []).forEach((a) => {
    const title = (a?.gameTitle || a?.title || '').trim();
    if (title) map.set(title.toLowerCase(), title);
  });

  // 3. Fallback to all standard platform games
  ALL_PLATFORM_GAMES.forEach((title) => {
    if (!map.has(title.toLowerCase())) {
      map.set(title.toLowerCase(), title);
    }
  });

  const list = Array.from(map.values());

  // Sort: User's linked active accounts first, then alphabetical
  list.sort((a, b) => {
    const aHas = (userAccounts || []).some(
      (acc) => (acc.gameTitle || '').toLowerCase().trim() === a.toLowerCase().trim()
    );
    const bHas = (userAccounts || []).some(
      (acc) => (acc.gameTitle || '').toLowerCase().trim() === b.toLowerCase().trim()
    );
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return a.localeCompare(b);
  });

  return list;
}

