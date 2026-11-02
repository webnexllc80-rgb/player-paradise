/**
 * Zero-Flicker Deep Diffing Utilities for React State & Silent Background Polling
 * Ensures that if background polling returns identical data, React receives
 * the identical state reference and bails out of re-rendering, eliminating
 * screen flickering, input focus loss, and scroll jumps.
 */

export function areEqual(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  if (typeof a !== 'object' || typeof b !== 'object') {
    return a === b;
  }

  // Handle Arrays
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!areEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Handle Objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!areEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * State updater helper that bails out if the new data is identical to previous state.
 * @param {Function} setter - React dispatch/setState function
 * @param {any} nextVal - Newly fetched data
 */
export function diffSet(setter, nextVal) {
  if (typeof setter !== 'function') return;
  setter((prev) => (areEqual(prev, nextVal) ? prev : nextVal));
}
