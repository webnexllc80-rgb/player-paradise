import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'players_paradise_cyber_secret_key_2026_panda_gaming_hub';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OPERATION_ADMIN: 'operation_admin',
  FINANCIAL_MANAGER: 'financial_manager',
  COIN_MANAGER: 'coin_manager',
  CHAT_SUPPORT: 'chat_support',
  PLAYER: 'player',
};

// Map each role to permitted administrative tabs
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    'overview',
    'requests',
    'account_requests',
    'coins_allotment',
    'games',
    'finance',
    'gateways',
    'tx_search',
    'users',
    'ledger',
    'chat',
    'promos',
    'affiliates',
    'affiliate_commissions',
    'staff',
    'settings',
  ],
  [ROLES.OPERATION_ADMIN]: [
    'overview',
    'requests',
    'account_requests',
    'coins_allotment',
    'games',
    'finance',
    'gateways',
    'tx_search',
    'users',
    'ledger',
    'chat',
    'promos',
    'affiliates',
    'affiliate_commissions',
  ],
  [ROLES.FINANCIAL_MANAGER]: [
    'overview',
    'finance',
    'coins_allotment',
    'ledger',
    'gateways',
    'tx_search',
  ],
  [ROLES.COIN_MANAGER]: [
    'overview',
    'requests',
    'account_requests',
    'coins_allotment',
    'tx_search',
  ],
  [ROLES.CHAT_SUPPORT]: [
    'overview',
    'chat',
  ],
  [ROLES.ADMIN]: [
    'overview',
    'requests',
    'account_requests',
    'coins_allotment',
    'games',
    'finance',
    'gateways',
    'tx_search',
    'users',
    'ledger',
    'chat',
    'promos',
    'affiliates',
    'affiliate_commissions',
    'staff',
    'settings',
  ],
};

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('players_session')?.value || cookieStore.get('vegas_session')?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function hasPermission(role, section) {
  if (role === ROLES.SUPER_ADMIN) return true;
  const allowed = ROLE_PERMISSIONS[role] || [];
  return allowed.includes(section);
}

export function toMongoId(id) {
  if (!id) return id;
  const str = String(id);
  if (/^[0-9a-fA-F]{24}$/.test(str)) {
    try {
      const { ObjectId } = require('mongodb');
      return new ObjectId(str);
    } catch {}
  }
  return id;
}

export function getUserFilter(sessionUser) {
  if (!sessionUser) return { _id: null };
  const uid = typeof sessionUser === 'object' ? sessionUser.userId : sessionUser;
  const strId = String(uid || '');
  const or = [];
  if (strId) {
    or.push({ _id: strId });
    if (/^[0-9a-fA-F]{24}$/.test(strId)) {
      try {
        const { ObjectId } = require('mongodb');
        or.push({ _id: new ObjectId(strId) });
      } catch {}
    }
  }
  if (typeof sessionUser === 'object') {
    if (sessionUser.username) or.push({ username: sessionUser.username });
    if (sessionUser.email) or.push({ email: sessionUser.email });
  }
  return or.length > 0 ? { $or: or } : { _id: strId };
}

export function safeIdFilter(id, extraFields = []) {
  if (!id) return { _id: null };
  const strId = String(id);
  const or = [{ _id: strId }, { id: strId }];
  if (/^[0-9a-fA-F]{24}$/.test(strId)) {
    try {
      const { ObjectId } = require('mongodb');
      or.push({ _id: new ObjectId(strId) });
    } catch {}
  }
  for (const field of extraFields) {
    or.push({ [field]: strId });
  }
  return { $or: or };
}
