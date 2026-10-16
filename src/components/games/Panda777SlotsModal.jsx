'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  X,
  Sparkles,
  Zap,
  Volume2,
  RefreshCw,
  Trophy,
  Info,
  DollarSign
} from 'lucide-react';

export default function Panda777SlotsModal({
  isOpen,
  onClose,
  user,
  onBalanceUpdated,
}) {
  const [currency, setCurrency] = useState('SC');
  const [bet, setBet] = useState(1);
  const [reels, setReels] = useState([
    { name: 'Panda Wild', icon: '🐼', multiplier: 25 },
    { name: 'Neon 777', icon: '7️⃣', multiplier: 15 },
    { name: 'Cyber Diamond', icon: '💎', multiplier: 10 },
  ]);
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSpin = async () => {
    if (spinning) return;
    setError('');
    setLastWin(null);
    setSpinning(true);

    try {
      const res = await fetch('/api/games/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameType: 'panda-777-slots',
          currency,
          betAmount: bet,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Spin failed.');
      }

      // Simulate 1.2s spin reel blur
      setTimeout(() => {
        setReels(data.result.reels);
        setSpinning(false);

        if (data.winAmount > 0) {
          setLastWin({
            amount: data.winAmount,
            multiplier: data.result.multiplier,
            isJackpot: data.result.isJackpot,
          });

          confetti({
            particleCount: data.result.isJackpot ? 120 : 50,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#00f0ff', '#c026d3', '#f59e0b', '#10b981'],
          });
        }

        if (onBalanceUpdated) onBalanceUpdated();
      }, 1100);
    } catch (err) {
      setSpinning(false);
      setError(err.message);
    }
  };

  const betChips = currency === 'SC' ? [0.5, 1, 2, 5, 10, 25] : [100, 500, 1000, 2500, 5000];

  return (
    <div className="cyber-modal-overlay">
      <div className="relative w-full max-w-xl rounded-3xl border-2 border-[var(--neon-cyan)] bg-[#070919] p-4 sm:p-6 md:p-8 shadow-[0_0_50px_rgba(0,240,255,0.35)] max-h-[92vh] overflow-y-auto modal-scrollable">
        {/* Glow & Sound buttons */}
        <div className="absolute top-0 right-1/4 w-72 h-72 bg-[var(--neon-cyan)]/15 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors z-20"
        >
          <X size={18} />
        </button>

        {/* Game Title */}
        <div className="text-center space-y-1 mb-5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--neon-cyan)]/20 border border-[var(--neon-cyan)]/40 text-[var(--neon-cyan)] font-sub text-xs font-bold">
            <Zap size={13} />
            <span>98.4% RTP • HIGH VOLATILITY CYBER SLOTS</span>
          </div>
          <h2 className="font-heading font-black text-2xl md:text-3xl text-white">
            PANDA 777 <span className="text-[var(--neon-cyan)]">CYBER SLOTS</span>
          </h2>
        </div>

        {/* Reels Machine Box */}
        <div className="p-4 md:p-6 rounded-3xl bg-slate-950 border-2 border-slate-800 shadow-inner mb-5 relative">
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {reels.map((r, i) => (
              <div
                key={i}
                className={`aspect-square rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 flex flex-col items-center justify-center transition-all ${
                  spinning
                    ? 'animate-pulse border-[var(--neon-cyan)] shadow-[0_0_20px_rgba(0,240,255,0.5)]'
                    : 'border-slate-800'
                }`}
              >
                <span className={`text-5xl md:text-6xl transition-transform ${spinning ? 'scale-90 blur-[2px]' : 'scale-100'}`}>
                  {r.icon}
                </span>
                <span className="text-[10px] font-heading font-bold text-slate-400 mt-2">
                  {r.name}
                </span>
              </div>
            ))}
          </div>

          {/* Win Announcement Banner */}
          {lastWin && (
            <div className="mt-4 p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/60 text-center animate-bounce">
              <span className="font-heading font-black text-lg text-emerald-300">
                WINNER! +${lastWin.amount.toFixed(2)} {currency} ({lastWin.multiplier}x)
              </span>
            </div>
          )}

          {error && (
            <div className="mt-4 p-2.5 rounded-xl bg-red-950/60 border border-red-500/50 text-xs text-red-200 text-center">
              {error}
            </div>
          )}
        </div>

        {/* Single Currency & Bet Controls */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SELECT CHIP:</span>
            </div>

            {/* Current Single Balance */}
            <div className="text-right">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">BALANCE:</span>
              <div className="font-mono font-black text-sm text-emerald-400">
                ${Number(user?.balance ?? user?.balanceSC ?? 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Bet selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {betChips.map((chip) => (
              <button
                key={chip}
                onClick={() => setBet(chip)}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-mono font-bold transition-all ${
                  bet === chip
                    ? 'bg-[var(--neon-cyan)] text-black shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                ${chip}
              </button>
            ))}
          </div>

          {/* Spin Button */}
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="w-full py-4 rounded-2xl font-heading font-black text-lg tracking-widest bg-gradient-to-r from-[var(--neon-cyan)] via-blue-500 to-[var(--neon-purple)] text-black shadow-[0_0_30px_rgba(0,240,255,0.5)] hover:scale-101 active:scale-99 transition-all disabled:opacity-50"
          >
            {spinning ? 'SPINNING MATRIX...' : `SPIN • BET $${bet}`}
          </button>
        </div>
      </div>
    </div>
  );
}
