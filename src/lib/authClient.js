/**
 * authClient.js - High-performance client-side auth & session manager
 * 1. Deduplicates simultaneous calls to /api/auth/me (3 calls become 1 call).
 * 2. Caches session in localStorage for 0ms instant page loads without UI flicker.
 * 3. Throttles rapid focus/sync triggers.
 */

let inFlightAuthPromise = null;
let lastAuthResponseTime = 0;
let lastAuthResult = null;

export function getCachedUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('pp_user_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user) {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem('pp_user_session', JSON.stringify(user));
      if (user.email) {
        localStorage.setItem('pp_user_email', user.email);
      }
    } else {
      localStorage.removeItem('pp_user_session');
      localStorage.removeItem('pp_user_email');
    }
  } catch {}
}

export async function fetchCurrentUser({ force = false } = {}) {
  const now = Date.now();

  // Return recent in-memory result if called within 3 seconds
  if (!force && lastAuthResult && now - lastAuthResponseTime < 3000) {
    return lastAuthResult;
  }

  // Deduplicate in-flight requests: share single fetch promise among all callers
  if (inFlightAuthPromise) {
    return inFlightAuthPromise;
  }

  inFlightAuthPromise = (async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (!res.ok) {
        setCachedUser(null);
        lastAuthResult = { authenticated: false, user: null };
        lastAuthResponseTime = Date.now();
        return lastAuthResult;
      }

      const data = await res.json();
      if (data?.authenticated && data?.user) {
        setCachedUser(data.user);
        lastAuthResult = data;
      } else {
        setCachedUser(null);
        lastAuthResult = { authenticated: false, user: null };
      }
      lastAuthResponseTime = Date.now();
      return lastAuthResult;
    } catch {
      return { authenticated: false, user: null };
    } finally {
      inFlightAuthPromise = null;
    }
  })();

  return inFlightAuthPromise;
}
