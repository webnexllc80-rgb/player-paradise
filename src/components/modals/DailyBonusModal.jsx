'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  Gift,
  Sparkles,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function DailyBonusModal({
  isOpen,
  onClose,
  user,
  onBonusClaimed,
  onOpenAuth,
}) {
  const [claiming, setClaiming] = useState(false);
  const [reward, setReward] = useState(null);
  const [cooldown, setCooldown] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleClaim = async () => {
    if (!user) {
      onClose();
      onOpenAuth('login');
      return;
    }

    setClaiming(true);
    setError('');

    try {
      const res = await fetch('/api/freeplay', { method: 'POST' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.cooldown) {
          setCooldown(data.remainingHours);
        } else {
          throw new Error(data.message || 'Unable to claim bonus at this time.');
        }
        return;
      }

      setReward(data.reward);

      // Trigger Confetti Celebration
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00f0ff', '#c026d3', '#f59e0b', '#10b981'],
      });

      if (onBonusClaimed) onBonusClaimed();
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="cyber-modal-overlay">
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--chrome-border)] bg-[var(--bg-deep)] p-6 md:p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors z-20"
        >
          <X size={18} />
        </button>

        <div className="relative z-10 space-y-4">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-purple-600 p-1 shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-bounce">
            <div className="w-full h-full bg-[#0a0e22] rounded-[20px] flex items-center justify-center text-amber-400">
              <Gift size={36} />
            </div>
          </div>

          <div>
            <h2 className="font-heading font-black text-2xl text-white">
              DAILY CYBER CRATE
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Unlock your 24-hour mystery reward! Free SC and GC every single day.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center gap-2 text-xs text-red-200">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {cooldown && (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 space-y-1">
              <div className="flex items-center justify-center gap-1.5 font-bold font-heading text-sm text-amber-300">
                <Clock size={16} />
                <span>BONUS ON COOLDOWN</span>
              </div>
              <p>Next mystery drop unlocks in approx {cooldown} hours!</p>
            </div>
          )}

          {reward && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-center gap-1.5 font-bold font-heading text-base text-emerald-300">
                <Sparkles size={18} />
                <span>{reward.label} UNLOCKED!</span>
              </div>
              <div className="flex items-center justify-center gap-3">
                <span className="font-mono font-black text-xl text-white bg-emerald-900/60 px-3 py-1 rounded-xl border border-emerald-500/40">
                  +${reward.sc} SC
                </span>
                <span className="font-mono font-black text-xl text-purple-300 bg-purple-900/60 px-3 py-1 rounded-xl border border-purple-500/40">
                  +{reward.gc.toLocaleString()} GC
                </span>
              </div>
              <p className="text-[11px] text-slate-300">Balance updated automatically!</p>
            </div>
          )}

          {!reward && !cooldown && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full py-3.5 rounded-xl font-heading font-black text-sm tracking-wider bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:brightness-110 transition-all"
            >
              {claiming ? 'DECRYPTING CRATE...' : 'OPEN CRATE NOW'}
            </button>
          )}

          {(reward || cooldown) && (
            <button
              onClick={onClose}
              className="w-full cyber-btn-outline py-2.5 text-xs font-bold"
            >
              CLOSE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
