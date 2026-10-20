'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  KeyRound,
  Download,
  ShieldCheck,
  Play,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export default function ExternalGameModal({
  isOpen,
  onClose,
  game,
  user,
  onRequestAccount,
  onOpenAuth,
  userGameAccounts = [],
  pendingAccountRequests = [],
}) {
  const [credentials, setCredentials] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  const cleanGameTitle = (game?.title || '').toLowerCase().trim();

  // Instant check from props passed by parent
  const propCredentials = (userGameAccounts || []).find((a) => {
    const t = (a.gameTitle || '').toLowerCase().trim();
    return t === cleanGameTitle || (cleanGameTitle && t.includes(cleanGameTitle)) || (t && cleanGameTitle.includes(t));
  });

  const propIsPending = !propCredentials && (pendingAccountRequests || []).some((p) => {
    const t = (p.gameTitle || '').toLowerCase().trim();
    return t === cleanGameTitle || (cleanGameTitle && t.includes(cleanGameTitle)) || (t && cleanGameTitle.includes(t));
  });

  const effectiveCredentials = credentials || propCredentials;
  const effectiveIsPending = !effectiveCredentials && (isPending || propIsPending);

  useEffect(() => {
    if (isOpen && user && game) {
      const emailParam = user.email ? `?email=${encodeURIComponent(user.email)}` : '';
      fetch(`/api/game-accounts${emailParam}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            const cleanTitle = (game.title || '').toLowerCase().trim();
            const found = (data.gameAccounts || []).find((a) => {
              const t = (a.gameTitle || '').toLowerCase().trim();
              return t === cleanTitle || (cleanTitle && t.includes(cleanTitle)) || (t && cleanTitle.includes(t));
            });
            setCredentials(found || null);

            const pending = (data.pendingRequests || []).find((p) => {
              const t = (p.gameTitle || '').toLowerCase().trim();
              return t === cleanTitle || (cleanTitle && t.includes(cleanTitle)) || (t && cleanTitle.includes(t));
            });
            setIsPending(Boolean(pending));
          }
        })
        .catch(() => {});
    } else {
      setCredentials(null);
      setIsPending(false);
    }
  }, [isOpen, user, game]);

  if (!isOpen || !game) return null;

  const copyText = (txt, type) => {
    navigator.clipboard.writeText(txt);
    if (type === 'user') {
      setCopiedUser(true);
      setTimeout(() => setCopiedUser(false), 2000);
    } else {
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  };

  const launchGame = () => {
    const url = game.playUrl || 'https://ultrapanda.mobi';
    window.open(url, '_blank');
  };

  return (
    <div className="cyber-modal-overlay">
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--chrome-border)] bg-[var(--bg-deep)] p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors z-20"
        >
          <X size={18} />
        </button>

        <div className="text-center space-y-3 mb-6">
          <div
            className="relative w-20 h-20 mx-auto rounded-2xl overflow-hidden border-2 border-[var(--neon-cyan)] shadow-[0_0_20px_rgba(0,240,255,0.4)] bg-slate-950"
            style={{ position: 'relative', width: '80px', height: '80px', minWidth: '80px', margin: '0 auto' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={game.thumbnail || game.image || game.imageUrl || game.fallbackImage || '/images/vegas-777.svg'}
              alt={game.title}
              onError={(e) => {
                if (e.currentTarget.src !== '/images/vegas-777.svg') {
                  e.currentTarget.src = '/images/vegas-777.svg';
                }
              }}
              className="w-full h-full object-cover"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div>
            <h2 className="font-heading font-black text-xl text-white">
              {game.title}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Official {game.platform || 'Online Sweeps'} Platform
            </p>
          </div>
        </div>

        {/* Credentials Box */}
        {effectiveCredentials ? (
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/40 space-y-3 mb-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-sub font-bold text-slate-400">YOUR LOGIN CREDENTIALS</span>
              <span className="text-[10px] font-bold text-emerald-400">READY</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-400">Username:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-white">{effectiveCredentials.username}</span>
                  <button
                    onClick={() => copyText(effectiveCredentials.username, 'user')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-[var(--neon-cyan)]"
                  >
                    {copiedUser ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-400">Password:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-amber-300">{effectiveCredentials.password}</span>
                  <button
                    onClick={() => copyText(effectiveCredentials.password, 'pass')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400"
                  >
                    {copiedPass ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : effectiveIsPending ? (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-2.5 mb-5 text-center">
            <Clock size={24} className="mx-auto text-amber-400 animate-spin" />
            <div>
              <div className="font-heading font-bold text-xs text-amber-200">
                ID GENERATION IN PROGRESS
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Your request for {game.title} is being processed by staff. Please wait a few moments.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-900/40 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
              <Clock size={12} className="animate-spin" />
              <span>REQUEST PENDING ⏳</span>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 mb-5 text-center">
            <KeyRound size={24} className="mx-auto text-amber-400" />
            <p className="text-xs text-slate-300">
              Need login credentials for {game.title}? Submit a 1-click request to our coin manager!
            </p>
            <button
              onClick={() => {
                onClose();
                onRequestAccount(game);
              }}
              className="cyber-btn-cyan py-2 px-4 text-xs font-bold"
            >
              <KeyRound size={14} />
              <span>REQUEST LOGIN ID</span>
            </button>
          </div>
        )}

        {/* Action button */}
        <button
          onClick={launchGame}
          className="w-full py-3.5 rounded-xl font-heading font-black text-sm tracking-wider bg-gradient-to-r from-[var(--neon-cyan)] to-blue-500 text-black shadow-[0_0_20px_rgba(0,240,255,0.4)] flex items-center justify-center gap-2 hover:scale-101 transition-transform"
        >
          <Play size={16} fill="currentColor" />
          <span>LAUNCH WEB PLATFORM</span>
          <ExternalLink size={14} />
        </button>
      </div>
    </div>
  );
}
