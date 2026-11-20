import crypto from 'crypto';
import { ROLES } from './auth';

const ADMIN_AUTH_SETTINGS_KEY = 'admin_auth';

export function isStaffRole(role) {
  return (
    role === ROLES.SUPER_ADMIN ||
    role === ROLES.ADMIN ||
    role === ROLES.OPERATION_ADMIN ||
    role === ROLES.FINANCIAL_MANAGER ||
    role === ROLES.COIN_MANAGER ||
    role === ROLES.CHAT_SUPPORT
  );
}

export function adminPasswordFingerprint(plain) {
  const trimmed = typeof plain === 'string' ? plain.trim() : '';
  if (!trimmed) return null;
  return crypto.createHash('sha256').update(trimmed, 'utf8').digest('hex');
}

export function getStaffSessionEpochSync() {
  const epoch = global._ppStaffSessionEpoch;
  return epoch !== undefined && epoch !== null ? String(epoch) : undefined;
}

export async function loadStaffSessionEpoch(db) {
  try {
    const doc = await db.collection('system_settings').findOne({ key: ADMIN_AUTH_SETTINGS_KEY });
    const epoch = String(doc?.staffSessionEpoch ?? '0');
    global._ppStaffSessionEpoch = epoch;
    return epoch;
  } catch {
    const fallback = '0';
    global._ppStaffSessionEpoch = fallback;
    return fallback;
  }
}

/**
 * When ADMIN_PASSWORD in .env changes, bump staffSessionEpoch so every staff JWT is invalid.
 */
export async function syncAdminEnvPasswordRotation(db) {
  const adminPlain = process.env.ADMIN_PASSWORD?.trim();
  const newFingerprint = adminPasswordFingerprint(adminPlain);

  const settingsCol = db.collection('system_settings');
  const existing = await settingsCol.findOne({ key: ADMIN_AUTH_SETTINGS_KEY });

  if (!newFingerprint) {
    await loadStaffSessionEpoch(db);
    return;
  }

  const oldFingerprint = existing?.adminPasswordFingerprint || null;

  if (oldFingerprint && oldFingerprint !== newFingerprint) {
    const newEpoch = Date.now().toString();
    await settingsCol.updateOne(
      { key: ADMIN_AUTH_SETTINGS_KEY },
      {
        $set: {
          key: ADMIN_AUTH_SETTINGS_KEY,
          adminPasswordFingerprint: newFingerprint,
          staffSessionEpoch: newEpoch,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );
    global._ppStaffSessionEpoch = newEpoch;
    console.log('[Admin auth] ADMIN_PASSWORD changed — all staff admin sessions invalidated.');
    return;
  }

  const epoch = existing?.staffSessionEpoch
    ? String(existing.staffSessionEpoch)
    : '0';

  await settingsCol.updateOne(
    { key: ADMIN_AUTH_SETTINGS_KEY },
    {
      $set: {
        key: ADMIN_AUTH_SETTINGS_KEY,
        adminPasswordFingerprint: newFingerprint,
        staffSessionEpoch: epoch,
        updatedAt: new Date(),
      },
    },
    { upsert: true }
  );
  global._ppStaffSessionEpoch = epoch;
}

export async function getStaffSessionEpochForLogin(db) {
  const cached = getStaffSessionEpochSync();
  if (cached !== undefined) return cached;
  return loadStaffSessionEpoch(db);
}

export async function staffSessionMatchesToken(verified) {
  if (!verified || !isStaffRole(verified.role)) return true;

  let epoch = getStaffSessionEpochSync();
  if (epoch === undefined) {
    try {
      const { getDb } = await import('./mongodb');
      const db = await getDb();
      epoch = await loadStaffSessionEpoch(db);
    } catch {
      return false;
    }
  }

  const tokenEpoch = String(verified.staffSessionEpoch ?? '0');
  return tokenEpoch === String(epoch);
}