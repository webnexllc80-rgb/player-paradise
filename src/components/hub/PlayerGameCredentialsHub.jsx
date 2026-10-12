'use client';

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  ShieldCheck,
  Sparkles,
  Clock,
  Gamepad2,
  RefreshCw
} from 'lucide-react';

export default function PlayerGameCredentialsHub({
  user,
  onRequestNewGame,
  onOpenAuth,
}) {
  const [accounts, setAccounts] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [accRes, reqRes] = await Promise.all([
        fetch('/api/game-accounts'),
        fetch('/api/account-requests'),
      ]);
      const accData = await accRes.json();
      const reqData = await reqRes.json();

      if (accData.success) setAccounts(accData.gameAccounts || []);
      if (reqData.success) {
        // filter pending requests that don't yet have accounts
        setRequests(reqData.accountRequests?.filter((r) => r.status === 'PENDING') || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const togglePassword = (id) => {
    setShowPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!user) {
    return (
      <div className="w-full my-8 p-6 md:p-8 rounded-3xl border border-[var(--chrome-border)] bg-gradient-to-br from-[#0c122e] to-[#060814] relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--neon-purple)]/20 border border-[var(--neon-purple)]/40 text-[var(--neon-purple-light)] text-xs font-bold font-sub">
              <KeyRound size={14} />
              <span>PLAYER LOGIN CREDENTIALS HUB</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black font-heading text-white">
              Access Your Game Logins & Passwords
            </h2>
            <p className="text-sm text-slate-300 max-w-lg">
              Sign in to request and securely view your unique player credentials for Ultra Panda, Fire Kirin, Orion Stars, and Game Vault.
            </p>
          </div>
          <button
            onClick={() => onOpenAuth('login')}
            className="cyber-btn-cyan py-3 px-6 text-sm shrink-0"
          >
            <KeyRound size={16} />
            <span>SIGN IN TO ACCESS IDS</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full my-8 p-6 md:p-8 rounded-3xl border border-[var(--chrome-border)] bg-gradient-to-br from-[#0c122e] to-[#060814] shadow-2xl relative">
      {/* Station Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/40">
              <KeyRound size={18} />
            </span>
            <h2 className="text-xl md:text-2xl font-black font-heading text-white">
              MY GAME PASSWORDS & IDS
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Your official login accounts for connected sweepstakes platforms. Copy credentials and launch instantly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Refresh IDs"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onRequestNewGame}
            className="cyber-btn-cyan py-2.5 px-4 text-xs font-bold"
          >
            <Plus size={15} />
            <span>REQUEST NEW GAME ID</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="pt-6">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw size={24} className="animate-spin text-[var(--neon-cyan)]" />
            <span className="text-xs font-sub font-semibold">SYNCHRONIZING SECURE CREDENTIALS...</span>
          </div>
        ) : accounts.length === 0 && requests.length === 0 ? (
          /* Empty state */
          <div className="py-10 text-center space-y-4 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
              <KeyRound size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-bold text-base text-white">No Game Accounts Yet</h3>
              <p className="text-xs text-slate-400">
                You haven&apos;t requested any game accounts yet. Click below to request your username and password for Ultra Panda, Fire Kirin, Orion Stars, or any platform!
              </p>
            </div>
            <button
              onClick={onRequestNewGame}
              className="cyber-btn-cyan py-2.5 px-5 text-xs font-bold"
            >
              <Plus size={14} />
              <span>REQUEST YOUR FIRST GAME ID</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Active Ready Accounts */}
            {accounts.map((acc) => {
              const passVisible = showPasswords[acc.id];
              return (
                <div
                  key={acc.id}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700/80 hover:border-[var(--neon-cyan)]/80 transition-all shadow-lg space-y-3 relative group"
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gamepad2 size={16} className="text-[var(--neon-cyan)]" />
                      <span className="font-heading font-bold text-sm text-white">
                        {acc.gameTitle}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      ACTIVE
                    </span>
                  </div>

                  {/* Credentials Box */}
                  <div className="space-y-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
                    {/* Username */}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-mono text-[11px]">USERNAME:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white selection:bg-[var(--neon-cyan)]">
                          {acc.username}
                        </span>
                        <button
                          onClick={() => copyToClipboard(acc.username, `user_${acc.id}`)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-[var(--neon-cyan)] transition-colors"
                          title="Copy Username"
                        >
                          {copiedField === `user_${acc.id}` ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <span className="text-slate-400 font-mono text-[11px]">PASSWORD:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-300">
                          {passVisible ? acc.password : '••••••••'}
                        </span>
                        <button
                          onClick={() => togglePassword(acc.id)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                          title={passVisible ? 'Hide Password' : 'Show Password'}
                        >
                          {passVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(acc.password, `pass_${acc.id}`)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                          title="Copy Password"
                        >
                          {copiedField === `pass_${acc.id}` ? (
                            <Check size={14} className="text-emerald-400" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action row */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Ready to log in
                    </span>
                    <button
                      onClick={() => {
                        // Attempt to open web portal
                        let target = 'https://ultrapanda.mobi';
                        const titleLower = acc.gameTitle.toLowerCase();
                        if (titleLower.includes('fire')) target = 'http://firekirin.xyz:8580';
                        else if (titleLower.includes('orion')) target = 'http://orionstars.vip:8580';
                        else if (titleLower.includes('game vault')) target = 'https://download.gamevault999.com';
                        else if (titleLower.includes('milky')) target = 'http://milkywayapp.xyz';
                        else if (titleLower.includes('juwa')) target = 'https://m.juwa777.com';
                        window.open(target, '_blank');
                      }}
                      className="inline-flex items-center gap-1 text-[var(--neon-cyan)] hover:text-white font-bold transition-colors"
                    >
                      <span>LAUNCH PLATFORM</span>
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Pending Requests */}
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gamepad2 size={16} className="text-amber-400" />
                    <span className="font-heading font-bold text-sm text-white">
                      {req.gameTitle}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                    <Clock size={11} />
                    STAFF PENDING
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/70 border border-amber-500/20 text-xs text-slate-300">
                  <p>Our 24/7 coin manager is creating your unique login. Your credentials will appear here momentarily.</p>
                </div>

                <div className="text-[10px] text-amber-400/80 font-mono">
                  Submitted: {new Date(req.createdAt).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
