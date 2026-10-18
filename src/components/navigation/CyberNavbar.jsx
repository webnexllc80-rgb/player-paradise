'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Menu,
  Wallet,
  Gift,
  Bell,
  Volume2,
  VolumeX,
  User,
  LogOut,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  KeyRound,
  ArrowUpRight,
  Plus
} from 'lucide-react';

export default function CyberNavbar({
  onToggleSidebar,
  user,
  onOpenAuth,
  onOpenWallet,
  onOpenDailyBonus,
  onOpenSpinWheel,
  onOpenNotifications,
  onLogout,
  unreadNotifsCount = 0,
}) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [jackpot, setJackpot] = useState(184920.45);
  const profileRef = useRef(null);

  // Progressive jackpot ticker simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setJackpot((prev) => prev + (Math.random() * 0.45 + 0.05));
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header
      className="sticky top-0 z-30 w-full border-b border-[var(--chrome-border)]/60 bg-[var(--bg-deep)]/90 backdrop-blur-xl px-4 flex items-center justify-between gap-3"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        minHeight: 'calc(4rem + env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Left side: Hamburger toggle & brand emblem on mobile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-[var(--neon-cyan)] hover:border-[var(--neon-cyan)] transition-colors lg:hidden shrink-0"
        >
          <Menu size={20} />
        </button>

        <div
          onClick={() => router.push('/')}
          className="flex items-center gap-2 cursor-pointer lg:hidden shrink-0"
        >
          <div
            className="relative w-8 h-8 rounded-lg overflow-hidden border border-[var(--neon-cyan)] shrink-0"
            style={{ position: 'relative', width: '32px', height: '32px', minWidth: '32px', flexShrink: 0 }}
          >
            <Image src="/logo.png" alt="Logo" fill className="object-cover" />
          </div>
          <span className="font-heading font-black text-xs tracking-wider text-white hidden sm:inline">
            PARADISE<span className="text-[var(--neon-cyan)]">HUB</span>
          </span>
        </div>

        {/* Global Progressive Cyber Jackpot (Wide Desktop Only) */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
          </span>
          <span className="text-[10px] font-heading font-bold text-amber-400 tracking-wider">
            JACKPOT:
          </span>
          <span className="font-mono font-bold text-xs text-white tracking-wider">
            ${jackpot.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* Right side: Balances & User Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {user ? (
          <>
            {/* Live Single Wallet Balance Chip */}
            <Link
              href="/deposit"
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/90 border border-emerald-500/40 hover:border-emerald-400 shadow-inner group transition-all shrink-0"
              title="Player Wallet Balance (Click to Deposit)"
            >
              <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500 text-black uppercase tracking-wider">
                BAL
              </span>
              <span className="font-mono font-bold text-xs sm:text-sm text-emerald-400 group-hover:text-emerald-300">
                ${Number(user.balance ?? user.balanceSC ?? 0).toFixed(2)}
              </span>
            </Link>

            {/* Deposit Direct Action */}
            <Link
              href="/deposit"
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-black text-xs font-heading font-black shadow-[0_0_12px_rgba(16,185,129,0.35)] hover:scale-102 active:scale-98 transition-all shrink-0"
              title="Deposit Funds"
            >
              <Plus size={14} strokeWidth={3} />
              <span className="hidden sm:inline">DEPOSIT</span>
            </Link>

            {/* Redeem Cashout Direct Action (Wide screen only, also in sidebar & profile) */}
            <Link
              href="/withdraw"
              className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors shrink-0"
              title="Redeem Winnings"
            >
              <ArrowUpRight size={14} className="text-[var(--neon-cyan)]" />
              <span>Redeem</span>
            </Link>

            {/* Daily Lucky Spin Wheel Button */}
            {onOpenSpinWheel && (
              <button
                type="button"
                onClick={onOpenSpinWheel}
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-amber-300 text-xs font-bold transition-all shadow-[0_0_12px_rgba(245,158,11,0.25)] shrink-0"
                title="Daily Free Spin Wheel (Win up to $50)"
              >
                <Gift size={14} className="text-amber-400 animate-bounce" />
                <span className="hidden 2xl:inline">Daily Spin</span>
              </button>
            )}
          </>
        ) : (
          /* Guest Actions */
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => onOpenAuth('login')}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all shrink-0"
            >
              LOG IN
            </button>
            <button
              onClick={() => onOpenAuth('register')}
              className="cyber-btn-cyan text-xs py-1.5 px-3 sm:px-3.5 font-bold shrink-0"
            >
              <Sparkles size={13} />
              <span>PLAY NOW</span>
            </button>
          </div>
        )}

        {/* Daily Mystery Gift Button */}
        <button
          onClick={onOpenDailyBonus}
          className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-purple-600/20 border border-amber-500/40 text-amber-300 hover:border-amber-400 hover:scale-105 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0"
          title="Daily Mystery Reward"
        >
          <Gift size={16} />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400"></span>
        </button>

        {/* Notification Bell */}
        {user && (
          <button
            onClick={onOpenNotifications}
            className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/80 border border-slate-700/70 text-slate-300 hover:text-[var(--neon-cyan)] hover:border-[var(--neon-cyan)] transition-colors shrink-0"
            title="Notifications"
          >
            <Bell size={16} />
            {unreadNotifsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(244,63,94,0.6)]">
                {unreadNotifsCount}
              </span>
            )}
          </button>
        )}

        {/* Sound toggle (Desktop) */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="hidden xl:flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/80 border border-slate-700/70 text-slate-400 hover:text-white transition-colors shrink-0"
          title={soundEnabled ? 'Mute Audio' : 'Enable Audio'}
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        {/* User Profile Menu */}
        {user && (
          <div className="relative shrink-0" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-700/70 hover:border-[var(--neon-cyan)] transition-all shrink-0"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--neon-purple)] flex items-center justify-center text-black font-bold text-xs uppercase shadow-sm">
                {user.username ? user.username.charAt(0) : 'P'}
              </div>
              <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
            </button>

            {/* Profile Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[var(--bg-deep)] border border-[var(--chrome-border)] shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-slate-800">
                  <p className="font-heading font-bold text-sm text-white truncate">
                    {user.username}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30">
                      {user.vipTier || 'Bronze Panda'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      KYC: {user.kycStatus?.toUpperCase() || 'UNVERIFIED'}
                    </span>
                  </div>
                </div>

                <div className="py-1">
                  <div
                    onClick={() => {
                      onOpenWallet('deposit');
                      setProfileOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 rounded-xl cursor-pointer"
                  >
                    <Wallet size={15} className="text-emerald-400" />
                    <span>Wallet & Cashier</span>
                  </div>

                  <div
                    onClick={() => {
                      router.push('/ledger');
                      setProfileOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 rounded-xl cursor-pointer"
                  >
                    <KeyRound size={15} className="text-cyan-400" />
                    <span>Ledger & Activity</span>
                  </div>

                  <div
                    onClick={() => {
                      router.push('/promotions');
                      setProfileOpen(false);
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800/80 rounded-xl cursor-pointer"
                  >
                    <Sparkles size={15} className="text-amber-400" />
                    <span>VIP & Rewards</span>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-800">
                  <div
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-950/30 rounded-xl cursor-pointer font-semibold"
                  >
                    <LogOut size={15} />
                    <span>Log Out</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
