'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Zap,
  KeyRound,
  Wallet,
  Download,
  ShieldCheck,
  Flame,
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';

export default function CyberHeroBanner({
  user,
  onOpenAuth,
  onOpenWallet,
  onOpenGameRequest,
}) {
  const router = useRouter();

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border border-[var(--chrome-border)] bg-gradient-to-br from-[#0c122c] via-[#090d20] to-[#050711] p-6 md:p-10 shadow-[0_15px_50px_rgba(0,0,0,0.6)]">
      {/* Background Cyber Glowing Ambient Lights */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[var(--neon-cyan)]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[var(--neon-purple)]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0, 240, 255, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.2) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Headlines & CTAs */}
        <div className="lg:col-span-7 space-y-5">
          {/* Top Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/30 text-[var(--neon-cyan)] text-xs font-heading font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)]">
            <Flame size={14} className="text-amber-400 animate-pulse" />
            <span>OFFICIAL CYBER SWEEPSTAKES HUB</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-cyan)]"></span>
            <span className="text-slate-300">USA 2026</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-black font-heading leading-tight tracking-tight text-white">
            PLAYERS <span className="text-neon-cyan">PARADISE</span>{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--neon-purple-light)] to-pink-400">
              HUB
            </span>
          </h1>

          {/* Description */}
          <p className="text-sm md:text-base text-slate-300 max-w-xl leading-relaxed">
            Instant game credentials for <strong className="text-white">Ultra Panda</strong>,{' '}
            <strong className="text-white">Fire Kirin</strong>,{' '}
            <strong className="text-white">Orion Stars</strong>, and{' '}
            <strong className="text-white">Game Vault</strong>. 24/7 automated cashouts via Cash App & Crypto.
          </p>

          {/* Bonus Highlight Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/50 via-slate-900/70 to-cyan-950/40 border border-purple-500/30 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--neon-purple)] to-[var(--neon-cyan)] flex items-center justify-center text-black font-black text-xl shrink-0 shadow-[0_0_15px_rgba(192,38,211,0.5)]">
              %
            </div>
            <div>
              <div className="text-xs font-sub font-bold text-amber-300 uppercase tracking-wider">
                SIGNUP WELCOME PACKAGE
              </div>
              <div className="font-heading font-extrabold text-base sm:text-lg text-white">
                100% Match Bonus + Free 10,000 GC Credits
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onOpenGameRequest}
              className="cyber-btn-cyan py-3 px-6 text-sm"
            >
              <KeyRound size={17} />
              <span>REQUEST GAME ID</span>
            </button>

            <button
              onClick={() => router.push('/deposit')}
              className="cyber-btn-purple py-3 px-6 text-sm"
            >
              <Wallet size={17} />
              <span>INSTANT DEPOSIT</span>
            </button>

            <button
              onClick={() => router.push('/download-app')}
              className="cyber-btn-outline py-3 px-5 text-sm"
            >
              <Download size={17} />
              <span>GET MOBILE APP</span>
            </button>
          </div>

          {/* Mini Trust Stats */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800/80">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sub">
                <Clock size={13} className="text-emerald-400" />
                <span>CASHOUT SPEED</span>
              </div>
              <div className="font-heading font-bold text-sm text-white">Under 5 Min</div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sub">
                <ShieldCheck size={13} className="text-[var(--neon-cyan)]" />
                <span>PAYOUT RATIO</span>
              </div>
              <div className="font-heading font-bold text-sm text-emerald-400">100% Guaranteed</div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-sub">
                <Sparkles size={13} className="text-amber-400" />
                <span>PLATFORMS</span>
              </div>
              <div className="font-heading font-bold text-sm text-white">10+ Verified</div>
            </div>
          </div>
        </div>

        {/* Right Column: 3D Mascot Graphic Display */}
        <div className="lg:col-span-5 flex justify-center relative" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <div
            className="hero-mascot-box relative group"
            style={{
              position: 'relative',
              width: '320px',
              height: '320px',
              maxWidth: '100%',
              aspectRatio: '1/1',
              flexShrink: 0
            }}
          >
            {/* Ambient Circular Neon Rings */}
            <div
              className="absolute inset-0 rounded-full border-2 border-dashed border-[var(--neon-cyan)]/30 animate-spin"
              style={{ position: 'absolute', inset: 0, borderRadius: '9999px', animationDuration: '30s' }}
            />
            <div
              className="absolute inset-4 rounded-full border border-[var(--neon-purple)]/40 shadow-[0_0_30px_rgba(192,38,211,0.3)]"
              style={{ position: 'absolute', inset: '16px', borderRadius: '9999px' }}
            />

            {/* Mascot Image Card */}
            <div
              className="relative w-full h-full rounded-3xl overflow-hidden border-2 border-[var(--neon-cyan)] shadow-[0_0_35px_rgba(0,240,255,0.5)] bg-slate-950"
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                borderRadius: '24px',
                overflow: 'hidden'
              }}
            >
              <Image
                src="/logo.png"
                alt="Cyber Gamer Panda - Players Paradise Hub"
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                priority
              />

              {/* Bottom Badge inside image */}
              <div className="absolute bottom-3 left-3 right-3 p-2.5 rounded-xl bg-black/80 backdrop-blur-md border border-[var(--neon-cyan)]/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="font-heading text-xs font-bold text-white">ONLINE SERVER</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/20 px-2 py-0.5 rounded">
                  99.9% UPTIME
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
