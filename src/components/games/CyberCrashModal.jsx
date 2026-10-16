'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { X, Rocket, Zap, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function CyberCrashModal({
  isOpen,
  onClose,
  user,
  onBalanceUpdated,
}) {
  const [bet, setBet] = useState(1);
  const [currency, setCurrency] = useState('SC');
  const [targetMultiplier, setTargetMultiplier] = useState(2.0);
  const [playing, setPlaying] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [crashed, setCrashed] = useState(false);
  const [won, setWon] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef(null);

  if (!isOpen) return null;

  const startCrashGame = async () => {
    if (playing) return;
    setError('');
    setCrashed(false);
    setWon(false);
    setCurrentMultiplier(1.0);
    setPlaying(true);

    try {
      const res = await fetch('/api/games/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType: 'cyber-matrix-crash',
          currency,
          betAmount: bet,
          options: { cashoutMultiplier: targetMultiplier },
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Game failed.');
      }

      const crashPoint = data.result.crashPoint;
      const willWin = data.result.isWin;

      // Animate multiplier rising
      let mult = 1.0;
      const step = 0.04;
      const interval = setInterval(() => {
        mult += step;
        setCurrentMultiplier(Math.round(mult * 100) / 100);

        if (willWin && mult >= targetMultiplier) {
          clearInterval(interval);
          setPlaying(false);
          setWon(true);
          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#00f0ff', '#10b981', '#f59e0b'],
          });
          if (onBalanceUpdated) onBalanceUpdated();
        } else if (!willWin && mult >= crashPoint) {
          clearInterval(interval);
          setPlaying(false);
          setCrashed(true);
          if (onBalanceUpdated) onBalanceUpdated();
        }
      }, 50);
    } catch (err) {
      setPlaying(false);
      setError(err.message);
    }
  };

  return (
    <div className="cyber-modal-overlay">
      <div className="relative w-full max-w-lg rounded-3xl border-2 border-[var(--neon-purple)] bg-[#070919] p-5 sm:p-6 md:p-8 shadow-[0_0_50px_rgba(192,38,211,0.35)] max-h-[92vh] overflow-y-auto modal-scrollable">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors z-20"
        >
          <X size={18} />
        </button>

        <div className="text-center space-y-1 mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--neon-purple)]/20 border border-[var(--neon-purple)]/40 text-[var(--neon-purple-light)] font-sub text-xs font-bold">
            <Rocket size={13} />
            <span>CYBER MATRIX CRASH • UP TO 1000X MULTIPLIER</span>
          </div>
          <h2 className="font-heading font-black text-2xl text-white">
            CYBER MATRIX <span className="text-[var(--neon-purple-light)]">CRASH</span>
          </h2>
        </div>

        {/* Display Screen */}
        <div className="h-56 rounded-3xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center relative overflow-hidden mb-5">
          <div
            className={`font-mono font-black text-5xl md:text-6xl transition-all ${
              crashed
                ? 'text-rose-500 scale-95'
                : won
                ? 'text-emerald-400 scale-105 shadow-sm'
                : 'text-[var(--neon-cyan)]'
            }`}
          >
            {currentMultiplier.toFixed(2)}x
          </div>

          <div className="text-xs font-heading font-bold mt-2">
            {crashed ? (
              <span className="text-rose-400">CRASHED! QUANTUM COLLAPSE</span>
            ) : won ? (
              <span className="text-emerald-300">
                CASHOUT SUCCESS! +${(bet * targetMultiplier).toFixed(2)} {currency}
              </span>
            ) : playing ? (
              <span className="text-[var(--neon-purple-light)] animate-pulse">ROCKET ASCENDING...</span>
            ) : (
              <span className="text-slate-400">READY FOR LAUNCH</span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-xl bg-red-950/60 border border-red-500/50 text-xs text-red-200 text-center">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
                BET AMOUNT ($ USD)
              </label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={bet}
                disabled={playing}
                onChange={(e) => setBet(parseFloat(e.target.value) || 1)}
                className="cyber-input font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
                AUTO CASHOUT AT
              </label>
              <input
                type="number"
                min="1.1"
                step="0.1"
                value={targetMultiplier}
                disabled={playing}
                onChange={(e) => setTargetMultiplier(parseFloat(e.target.value) || 2.0)}
                className="cyber-input font-mono font-bold"
              />
            </div>
          </div>

          <button
            onClick={startCrashGame}
            disabled={playing}
            className="w-full py-4 rounded-2xl font-heading font-black text-base tracking-widest bg-gradient-to-r from-[var(--neon-purple)] via-pink-600 to-[var(--neon-cyan)] text-white shadow-[0_0_25px_rgba(192,38,211,0.5)] hover:scale-101 transition-all disabled:opacity-50"
          >
            {playing ? 'LAUNCHING...' : `LAUNCH ROCKET • BET $${bet}`}
          </button>
        </div>
      </div>
    </div>
  );
}
