'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Mail, Lock, User, Sparkles, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Registration failed.');
      }

      router.push('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-white flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md p-5 sm:p-8 rounded-3xl border border-[var(--chrome-border)] bg-[#070919] shadow-2xl space-y-6 relative overflow-hidden">
        <div className="text-center space-y-3">
          <Link href="/">
            <div
              className="relative w-16 h-16 mx-auto rounded-2xl overflow-hidden border-2 border-[var(--neon-purple)] shadow-[0_0_20px_rgba(192,38,211,0.4)]"
              style={{ position: 'relative', width: '64px', height: '64px', minWidth: '64px', margin: '0 auto' }}
            >
              <Image src="/logo.png" alt="Logo" fill className="object-cover" />
            </div>
          </Link>
          <h1 className="font-heading font-black text-2xl text-white">
            JOIN <span className="text-[var(--neon-purple-light)]">PARADISE</span>
          </h1>
          <p className="text-xs text-slate-400">Claim 100% Match Bonus + 10,000 Free GC</p>
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
              CHOOSE USERNAME
            </label>
            <input
              type="text"
              required
              placeholder="e.g. cyber_master"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="cyber-input"
            />
          </div>

          <div>
            <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
              EMAIL ADDRESS
            </label>
            <input
              type="email"
              required
              placeholder="yourname@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="cyber-input"
            />
          </div>

          <div>
            <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
              PASSWORD (MIN 6 CHARACTERS)
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
            className="w-full cyber-btn-purple py-3.5 rounded-xl font-heading font-black text-sm tracking-wider"
          >
            {loading ? 'INITIALIZING ACCOUNT...' : 'CREATE ACCOUNT & CLAIM BONUS'}
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--neon-cyan)] font-bold hover:underline">
            Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
