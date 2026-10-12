'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Mail, Lock, Sparkles, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
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
        throw new Error(data.message || 'Login failed.');
      }

      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autofillDemo = (role) => {
    if (role === 'admin') {
      setIdentifier('admin@playersparadisehub.com');
      setPassword('Paradise@2026!');
    } else {
      setIdentifier('player@demo.com');
      setPassword('Player@2026!');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-white flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md p-8 rounded-3xl border border-[var(--chrome-border)] bg-[#070919] shadow-2xl space-y-6 relative overflow-hidden">
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
          <p className="text-xs text-slate-400">Access your game accounts and wallet</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center gap-2 text-xs text-red-200">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
              EMAIL OR USERNAME
            </label>
            <input
              type="text"
              required
              placeholder="player@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="cyber-input"
            />
          </div>

          <div>
            <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
              PASSWORD
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="cyber-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full cyber-btn-cyan py-3.5 rounded-xl font-heading font-black text-sm tracking-wider"
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

          <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => autofillDemo('player')}
              className="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 text-slate-300"
            >
              Demo Player ($550 SC)
            </button>
            <button
              onClick={() => autofillDemo('admin')}
              className="text-[10px] font-bold px-2 py-1 rounded bg-rose-950 text-rose-300"
            >
              Super Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
