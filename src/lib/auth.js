import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'players_paradise_cyber_secret_key_2026_panda_gaming_hub';

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  OPERATION_ADMIN: 'operation_admin',
  FINANCIAL_MANAGER: 'financial_manager',
  COIN_MANAGER: 'coin_manager',
  CHAT_SUPPORT: 'chat_support',
  PLAYER: 'player',
};

// Map each role to permitted administrative tabs (No affiliates)
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    'overview',
    'requests',
    'games',
    'finance',
    'gateways',
    'tx_search',
    'users',
    'ledger',
    'chat',
    'kyc',
    'promos',
    'staff',
    'settings',
  ],
  [ROLES.OPERATION_ADMIN]: [
    'overview',
    'requests',
    'games',
    'finance',
    'gateways',
    'tx_search',
    'users',
    'ledger',
    'chat',
    'kyc',
    'promos',
  ],
  [ROLES.FINANCIAL_MANAGER]: [
    'overview',
    'finance',
    'ledger',
    'gateways',
    'tx_search',
    'kyc',
  ],
  [ROLES.COIN_MANAGER]: [
    'overview',
    'requests',
    'tx_search',
  ],
  [ROLES.CHAT_SUPPORT]: [
    'overview',
    'chat',
  ],
  [ROLES.PLAYER]: [],
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
    const token = cookieStore.get('players_session')?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function hasPermission(userRole, tab) {
  if (!userRole) return false;
  const allowed = ROLE_PERMISSIONS[userRole] || [];
  return allowed.includes(tab);
}
