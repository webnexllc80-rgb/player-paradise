'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Crown,
  Sparkles,
  Zap,
  Gift,
  ShieldCheck,
  Trophy,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import CyberNavbar from '@/components/navigation/CyberNavbar';
import CyberSidebar from '@/components/navigation/CyberSidebar';
import CyberMobileBottomNav from '@/components/navigation/CyberMobileBottomNav';
import CyberFooter from '@/components/common/CyberFooter';

export default function PromotionsPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const tiers = [
    {
      name: 'Bronze Panda',
      badge: 'TIER 1',
      perks: ['Free 5 SC Welcome Package', 'Daily Mystery Crate', '24/7 Live Support', 'Standard Cashout Queue'],
      scMin: '$0+',
      border: 'border-slate-700',
    },
    {
      name: 'Silver Cyber',
      badge: 'TIER 2',
      perks: ['5% Weekly Loss Rebate', 'Higher Daily Mystery Drops', 'Priority Game ID Release', 'Direct Cash App Desk'],
      scMin: '$250+',
      border: 'border-cyan-500/40',
    },
    {
      name: 'Gold Titan',
      badge: 'TIER 3',
      perks: ['10% Weekly Loss Rebate', 'Personal VIP Host Access', 'Expedited 3-Min Cashouts', 'Monthly Level-up Gift'],
      scMin: '$1,000+',
      border: 'border-amber-500/40',
    },
    {
      name: 'Diamond Elite',
      badge: 'TIER 4',
      perks: ['15% Instant Rakeback', 'No Cashout Limits', 'Private Discord & Telegram Desk', 'Custom Platform Bonus Codes'],
      scMin: '$5,000+',
      border: 'border-purple-500/50',
    },
    {
      name: 'Paradise Legend',
      badge: 'TIER 5',
      perks: ['25% Exclusive VIP Rakeback', 'Dedicated 24/7 Account Executive', 'Instant Unlimited Redemptions', 'VIP Birthday & Holiday Trips'],
      scMin: '$25,000+',
      border: 'border-rose-500/60',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-white flex flex-col">
      <CyberSidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        user={null}
        onOpenWallet={() => router.push('/wallet')}
        onOpenGameRequest={() => router.push('/')}
        onOpenChat={() => {}}
        onOpenDailyBonus={() => {}}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <CyberNavbar
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          user={null}
          onOpenAuth={() => router.push('/')}
          onOpenWallet={() => router.push('/wallet')}
          onOpenDailyBonus={() => {}}
          onOpenNotifications={() => {}}
          onLogout={() => {}}
        />

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 space-y-10">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-heading font-bold">
              <Crown size={14} />
              <span>CROWN VIP CLUB & REWARDS</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black font-heading text-white">
              PLAYERS PARADISE <span className="text-amber-400">VIP LOUNGE</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl mx-auto">
              Every spin on Ultra Panda, Fire Kirin, Orion Stars, and our in-house games advances your VIP rank. Climb from Bronze Panda to Paradise Legend!
            </p>
          </div>

          {/* Active Promotions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-950/60 to-slate-900 border border-purple-500/40 space-y-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500 text-white font-mono">
                100% MATCH
              </span>
              <h3 className="font-heading font-black text-xl text-white">
                FIRST DEPOSIT DOUBLE PACKAGE
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Deposit $20 or more via Cash App, Zelle, or Crypto and get 100% bonus match credits + 10,000 free Game Coins!
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-gradient-to-br from-cyan-950/60 to-slate-900 border border-[var(--neon-cyan)]/40 space-y-3">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--neon-cyan)] text-black font-mono font-bold">
                EVERY 24 HOURS
              </span>
              <h3 className="font-heading font-black text-xl text-white">
                DAILY CYBER MYSTERY CRATE
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Log in each day and unlock the gift box in your header bar for up to $10.00 in free SC credits and 50,000 GC.
              </p>
            </div>
          </div>

          {/* VIP Tiers */}
          <div className="space-y-4">
            <h2 className="font-heading font-black text-xl text-white text-center">
              LOYALTY TIERS & REBATES
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {tiers.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-2xl bg-slate-900/80 border ${t.border} space-y-3 flex flex-col justify-between`}
                >
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400">{t.badge}</span>
                    <h4 className="font-heading font-bold text-sm text-white">{t.name}</h4>
                    <span className="text-xs font-mono font-bold text-emerald-400 block">{t.scMin}</span>
                    <div className="space-y-1.5 pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                      {t.perks.map((p, pIdx) => (
                        <div key={pIdx} className="flex items-start gap-1.5">
                          <CheckCircle2 size={12} className="text-[var(--neon-cyan)] mt-0.5 shrink-0" />
                          <span>{p}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <CyberFooter />
      </div>

      <CyberMobileBottomNav user={null} onOpenAuth={() => {}} onOpenWallet={() => router.push('/wallet')} onOpenGameRequest={() => router.push('/')} />
    </div>
  );
}
