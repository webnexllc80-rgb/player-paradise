'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  X,
  Mail,
  Lock,
  User,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  ArrowRight
} from 'lucide-react';

export default function AuthModal({
  isOpen,
  onClose,
  initialTab = 'login',
  onSuccess,
}) {
  const [tab, setTab] = useState(initialTab);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        tab === 'login'
          ? { identifier: email || username, password }
          : { username, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed. Please check your credentials.');
      }

      setSuccessMsg(data.message || 'Success! Welcome to Players Paradise Hub.');
      setTimeout(() => {
        if (onSuccess) onSuccess(data.user);
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autofillDemo = (role) => {
    if (role === 'admin') {
      setEmail('admin@playersparadisehub.com');
      setPassword('Paradise@2026!');
      setTab('login');
    } else {
      setEmail('player@demo.com');
      setPassword('Player@2026!');
      setTab('login');
    }
  };

  return (
    <div className="cyber-modal-overlay">
      <div className="relative w-full max-w-md rounded-3xl border border-[var(--chrome-border)] bg-[var(--bg-deep)] p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--neon-cyan)]/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--neon-purple)]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors z-20"
        >
          <X size={18} />
        </button>

        {/* Modal Brand Logo Header */}
        <div className="text-center space-y-2 mb-6 relative z-10">
          <div className="relative w-16 h-16 mx-auto rounded-2xl overflow-hidden border-2 border-[var(--neon-cyan)] shadow-[0_0_20px_rgba(0,240,255,0.4)]">
            <Image src="/logo.png" alt="Players Paradise Hub" fill className="object-cover" />
          </div>
          <h2 className="font-heading font-black text-xl text-white">
            PLAYERS <span className="text-[var(--neon-cyan)]">PARADISE</span>
          </h2>
          <p className="text-xs text-slate-400">
            {tab === 'login' ? 'Sign in to access your game credentials and wallet' : 'Create an account & claim 100% Match Bonus + 10,000 GC'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-slate-800 mb-5 relative z-10">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError('');
            }}
            className={`py-2 text-xs font-heading font-bold rounded-lg transition-all ${
              tab === 'login'
                ? 'bg-gradient-to-r from-[var(--neon-cyan)] to-blue-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            SIGN IN
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError('');
            }}
            className={`py-2 text-xs font-heading font-bold rounded-lg transition-all ${
              tab === 'register'
                ? 'bg-gradient-to-r from-[var(--neon-purple)] to-pink-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            CREATE ACCOUNT
          </button>
        </div>

        {/* Status Alerts */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center gap-2 text-xs text-red-200">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center gap-2 text-xs text-emerald-200">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 relative z-10">
          {tab === 'register' && (
            <div>
              <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
                USERNAME
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. cyber_player"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="cyber-input pl-10"
                />
                <User size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
              {tab === 'login' ? 'EMAIL OR USERNAME' : 'EMAIL ADDRESS'}
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder={tab === 'login' ? 'player@example.com' : 'yourname@gmail.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="cyber-input pl-10"
              />
              <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
              PASSWORD
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="cyber-input pl-10 pr-10"
              />
              <Lock size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-white"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 mt-2 rounded-xl font-heading font-black text-sm tracking-wider flex items-center justify-center gap-2 transition-all ${
              tab === 'login' ? 'cyber-btn-cyan' : 'cyber-btn-purple'
            } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <span>VERIFYING...</span>
            ) : tab === 'login' ? (
              <>
                <span>SIGN IN NOW</span>
                <ArrowRight size={16} />
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>START PLAYING</span>
              </>
            )}
          </button>
        </form>

        {/* Demo Fast-Fill Shortcuts */}
        <div className="mt-5 pt-4 border-t border-slate-800 text-center relative z-10">
          <p className="text-[11px] text-slate-400 mb-2">QUICK TEST LOGINS:</p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => autofillDemo('player')}
              className="text-[10px] font-bold px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              🎮 Demo Player ($550 SC)
            </button>
            <button
              type="button"
              onClick={() => autofillDemo('admin')}
              className="text-[10px] font-bold px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-500/40 transition-colors"
            >
              👑 Super Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
