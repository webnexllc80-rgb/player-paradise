'use client';

import React, { useState, useEffect } from 'react';
import { X, Bell, CheckCheck, Clock, ShieldCheck, Sparkles } from 'lucide-react';

export default function NotificationsModal({ isOpen, onClose, user }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && user?.email) {
      setLoading(true);
      fetch(`/api/notifications?email=${encodeURIComponent(user.email)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setNotifs(data.notifications || []);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, user]);

  const markAllRead = async () => {
    if (!user?.email) return;
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAll: true, email: user.email }),
    });
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (!isOpen) return null;

  return (
    <div className="cyber-modal-overlay">
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--chrome-border)] bg-[var(--bg-deep)] p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.85)] max-h-[85vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-[var(--neon-cyan)]" />
            <h2 className="font-heading font-black text-lg text-white">NOTIFICATIONS</h2>
          </div>
          {notifs.some((n) => !n.read) && (
            <button
              onClick={markAllRead}
              className="text-[11px] font-bold text-[var(--neon-cyan)] hover:underline flex items-center gap-1"
            >
              <CheckCheck size={14} />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {loading ? (
            <p className="text-xs text-center text-slate-400 py-8">Loading updates...</p>
          ) : notifs.length === 0 ? (
            <div className="text-center py-10 space-y-2 text-slate-400">
              <Bell size={28} className="mx-auto text-slate-600" />
              <p className="text-xs">No notifications yet. You&apos;re all caught up!</p>
            </div>
          ) : (
            notifs.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 rounded-xl border text-xs space-y-1 transition-all ${
                  !n.read
                    ? 'bg-slate-900/90 border-[var(--neon-cyan)]/50 shadow-sm'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-white text-xs">{n.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
