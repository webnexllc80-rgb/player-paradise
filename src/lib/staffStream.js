import { EventEmitter } from 'events';

// Maintain a single global EventEmitter across hot reloads & workers in Next.js
if (!globalThis.__staffEventEmitter) {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(200);
  globalThis.__staffEventEmitter = emitter;
}

export const staffBroadcaster = globalThis.__staffEventEmitter;

/**
 * Dispatches real-time staff operations events to all connected admin consoles
 * via Server-Sent Events (SSE). 0ms zero-latency broadcast.
 */
export function broadcastStaffEvent(payload) {
  try {
    if (globalThis.__staffEventEmitter && payload) {
      globalThis.__staffEventEmitter.emit('staff_event', payload);
    }
  } catch (err) {
    console.warn('[broadcastStaffEvent error]:', err?.message);
  }
}

