'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Flame, Sparkles } from 'lucide-react';

export default function CyberLatestWinsTicker() {
  const [wins, setWins] = useState([]);

  useEffect(() => {
    fetch('/api/games/activity')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.activity) {
          setWins(data.activity);
        }
      })
      .catch(() => {});
  }, []);

  const defaultWins = [
    { username: 'CyberAce77', gameTitle: 'Ultra Panda', amount: 340.5, currency: 'SC' },
    { username: 'PandaKing99', gameTitle: 'Panda 777 Slots', amount: 820.0, currency: 'SC' },
    { username: 'MatrixNeo', gameTitle: 'Cyber Matrix Crash', amount: 450.0, currency: 'SC' },
    { username: 'NeonHunter', gameTitle: 'Fire Kirin', amount: 1250.0, currency: 'SC' },
    { username: 'VortexPlayer', gameTitle: 'Orion Stars', amount: 290.75, currency: 'SC' },
    { username: 'ShadowBlade', gameTitle: 'Game Vault 999', amount: 620.0, currency: 'SC' },
    { username: 'LuckyPanda', gameTitle: 'Juwa 777', amount: 380.0, currency: 'SC' },
  ];

  const displayList = wins.length > 0 ? wins : defaultWins;
  const doubleList = [...displayList, ...displayList];

  return (
    <div className="w-full my-6 overflow-hidden rounded-2xl border border-[var(--chrome-border)]/60 bg-gradient-to-r from-[#070918] via-[#0d122b] to-[#070918] py-2.5 px-3 flex items-center gap-3 shadow-lg">
      {/* Ticker Lead Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-black font-heading font-black text-xs shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.5)]">
        <Trophy size={14} />
        <span>LATEST WINS</span>
      </div>

      {/* Marquee Track */}
      <div className="flex-1 overflow-hidden relative">
        <div className="ticker-slide-track gap-4 items-center">
          {doubleList.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-700/60 shrink-0 text-xs shadow-sm hover:border-[var(--neon-cyan)] transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] flex items-center justify-center font-bold text-[10px]">
                {item.username.charAt(0)}
              </div>
              <span className="font-semibold text-slate-300">{item.username}</span>
              <span className="text-slate-500">•</span>
              <span className="text-[var(--neon-purple-light)] font-medium">{item.gameTitle}</span>
              <span className="font-mono font-bold text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
                +${Number(item.amount).toFixed(2)} {item.currency}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
