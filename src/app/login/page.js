'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Mail, Lock, Sparkles, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck, User } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Login failed. Please verify credentials.');
      }

      // If user is admin/staff or redirect is /admin, go to /admin
      if (data.isAdmin || redirectTarget === '/admin' || (data.user?.role && data.user.role !== 'player')) {
        router.push('/admin');
      } else if (redirectTarget) {
        router.push(redirectTarget);
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autofillAdmin = () => {
    setIdentifier('superadmin');
    setPassword('Paradise@2026!');
    setError('');
  };

  const autofillDemo = () => {
    setIdentifier('player@demo.com');
    setPassword('Player@2026!');
    setError('');
  };

  return (
    <div className="w-full max-w-md p-5 sm:p-8 rounded-3xl border border-[var(--chrome-border)] bg-[#070919] shadow-2xl space-y-6 relative overflow-hidden">
      <div className="text-center space-y-3">
        <Link href="/">
          <div
            className="relative w-16 h-16 mx-auto rounded-2xl overflow-hidden border-2 border-[var(--neon-cyan)] shadow-[0_0_20px_rgba(0,240,255,0.4)]"
            style={{ position: 'relative', width: '64px', height: '64px', minWidth: '64px', margin: '0 auto' }}
          >
            <Image src="/logo.png" alt="Logo" fill className="object-cover" />
          </div>
        </Link>
        <h1 className="font-heading font-black text-2xl text-white">
          SIGN IN TO <span className="text-[var(--neon-cyan)]">PARADISE</span>
        </h1>
        <p className="text-xs text-slate-400">Access your game accounts, wallet, or admin portal</p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/50 flex items-start gap-2.5 text-xs text-red-200">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
            EMAIL OR USERNAME
          </label>
          <div className="relative">
            <input
              type="text"
              required
              placeholder="superadmin or player@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="cyber-input"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
            PASSWORD
          </label>
          <div className="relative">
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="cyber-input"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full cyber-btn-cyan py-3.5 rounded-xl font-heading font-black text-sm tracking-wider cursor-pointer"
        >
          {loading ? 'VERIFYING...' : 'SIGN IN NOW'}
        </button>
      </form>

      <div className="pt-2 text-center text-xs text-slate-400 space-y-3">
        <p>
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[var(--neon-cyan)] font-bold hover:underline">
            Sign up free
          </Link>
        </p>

        {/* Quick Autofill Helpers */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
            Quick Auto-Fill Logins:
          </span>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={autofillAdmin}
              className="px-2.5 py-1.5 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-300 hover:bg-purple-900/60 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ShieldCheck size={13} className="text-purple-400" />
              <span>Super Admin</span>
            </button>
            <button
              type="button"
              onClick={autofillDemo}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <User size={13} className="text-[var(--neon-cyan)]" />
              <span>Demo Player</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-white flex flex-col justify-center items-center p-4">
      <Suspense fallback={<div className="text-slate-400 text-xs">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
