'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Navigation Components
import CyberSidebar from '@/components/navigation/CyberSidebar';
import CyberNavbar from '@/components/navigation/CyberNavbar';
import CyberMobileBottomNav from '@/components/navigation/CyberMobileBottomNav';
import CyberFooter from '@/components/common/CyberFooter';

// Hub Sections
import CyberHeroBanner from '@/components/hub/CyberHeroBanner';
import CyberLatestWinsTicker from '@/components/hub/CyberLatestWinsTicker';
import PlayerGameCredentialsHub from '@/components/hub/PlayerGameCredentialsHub';
import GameCard from '@/components/hub/GameCard';

// Modals
import AuthModal from '@/components/modals/AuthModal';
import WalletModal from '@/components/modals/WalletModal';
import GameRequestModal from '@/components/modals/GameRequestModal';
import DailyBonusModal from '@/components/modals/DailyBonusModal';
import NotificationsModal from '@/components/modals/NotificationsModal';
import ExternalGameModal from '@/components/modals/ExternalGameModal';
import SubscriptionPromoModal from '@/components/modals/SubscriptionPromoModal';
import LoadCoinsModal from '@/components/modals/LoadCoinsModal';
import KycModal from '@/components/modals/KycModal';
import BonusAlertToast from '@/components/common/BonusAlertToast';
import PushNotificationManager from '@/components/common/PushNotificationManager';
import DailySpinWheelModal from '@/components/common/DailySpinWheelModal';

// Games
import Panda777SlotsModal from '@/components/games/Panda777SlotsModal';
import CyberCrashModal from '@/components/games/CyberCrashModal';

import {
  Gamepad2,
  Sparkles,
  Search,
  Filter,
  Flame,
  KeyRound,
  ShieldCheck,
  Zap,
  Gift,
  ArrowRight,
  Trophy
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();

  // User & UI States
  const [user, setUser] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Modals
  const [authModal, setAuthModal] = useState({ open: false, tab: 'login' });
  const [walletModal, setWalletModal] = useState({ open: false, tab: 'deposit' });
  const [gameRequestModal, setGameRequestModal] = useState({ open: false, initialGame: null });
  const [dailyBonusOpen, setDailyBonusOpen] = useState(false);
  const [spinWheelOpen, setSpinWheelOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [activeExternalGame, setActiveExternalGame] = useState(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);
  const [loadCoinsModal, setLoadCoinsModal] = useState({ open: false, game: null });

  // In-House playable game modal states
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [crashOpen, setCrashOpen] = useState(false);

  // Games & Filter state
  const [games, setGames] = useState([]);
  const [category, setCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingGames, setLoadingGames] = useState(true);

  // Load User Session
  const loadUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  // Load Games
  const loadGames = async () => {
    setLoadingGames(true);
    try {
      let url = '/api/games';
      const params = new URLSearchParams();
      if (category !== 'all') params.append('category', category);
      if (searchTerm) params.append('search', searchTerm);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.games) {
        setGames(data.games);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    loadUser();

    const handleUserSync = (e) => {
      if (e.detail) setUser(e.detail);
    };

    const handleFocus = () => {
      loadUser();
    };

    window.addEventListener('paradise-user-sync', handleUserSync);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('paradise-user-sync', handleUserSync);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  useEffect(() => {
    loadGames();
  }, [category, searchTerm]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const handlePlayGame = (game) => {
    if (!user) {
      setAuthModal({ open: true, tab: 'login' });
      return;
    }

    if (game.id === 'panda-777-slots') {
      setSlotsOpen(true);
    } else if (game.id === 'cyber-matrix-crash') {
      setCrashOpen(true);
    } else {
      setActiveExternalGame(game);
    }
  };

  const handleRequestGame = (game = null) => {
    if (!user) {
      setAuthModal({ open: true, tab: 'login' });
      return;
    }
    setGameRequestModal({ open: true, initialGame: game });
  };

  const categories = [
    { id: 'all', label: 'All Games', icon: '🌟' },
    { id: 'sweeps', label: 'Web Sweeps', icon: '🎰' },
    { id: 'fish', label: 'Fish Arcade', icon: '🐟' },
    { id: 'slots', label: 'Cyber Slots', icon: '⚡' },
    { id: 'crash', label: 'Crash Matrix', icon: '🚀' },
    { id: 'table', label: 'Table Games', icon: '🃏' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-white flex flex-col">
      {/* Collapsible Sidebar */}
      <CyberSidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        user={user}
        onOpenWallet={(tab) => setWalletModal({ open: true, tab })}
        onOpenGameRequest={() => handleRequestGame()}
        onOpenChat={() => setChatOpen(true)}
        onOpenDailyBonus={() => setDailyBonusOpen(true)}
        onOpenSpinWheel={() => setSpinWheelOpen(true)}
      />

      {/* Main Content Layout */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Navbar */}
        <CyberNavbar
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          user={user}
          onOpenAuth={(tab) => setAuthModal({ open: true, tab })}
          onOpenWallet={(tab) => setWalletModal({ open: true, tab })}
          onOpenDailyBonus={() => setDailyBonusOpen(true)}
          onOpenSpinWheel={() => setSpinWheelOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onLogout={handleLogout}
          unreadNotifsCount={1}
        />

        {/* Page Inner Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
          {/* Hero Banner */}
          <CyberHeroBanner
            user={user}
            onOpenAuth={(tab) => setAuthModal({ open: true, tab })}
            onOpenWallet={(tab) => setWalletModal({ open: true, tab })}
            onOpenGameRequest={() => handleRequestGame()}
          />

          {/* Marquee Ticker */}
          <CyberLatestWinsTicker />

          {/* Player Game Credentials & Request Station */}
          <PlayerGameCredentialsHub
            user={user}
            onRequestNewGame={() => handleRequestGame()}
            onOpenAuth={(tab) => setAuthModal({ open: true, tab })}
          />

          {/* Game Catalog Station */}
          <div className="space-y-6 pt-4">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Gamepad2 size={20} className="text-[var(--neon-cyan)]" />
                  <h2 className="font-heading font-black text-2xl text-white">
                    VERIFIED GAMES & PLATFORMS
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Play in-house cyber originals or access popular external sweeps platforms
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-80">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
                <input
                  type="text"
                  placeholder="Search Ultra Panda, Fire Kirin..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#060917]/95 border border-[var(--neon-cyan)]/30 rounded-xl !pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--neon-cyan)] focus:shadow-[0_0_15px_rgba(0,240,255,0.25)] transition-all font-sans"
                />
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {categories.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-heading font-bold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-[var(--neon-cyan)] to-blue-500 text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                        : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Games Grid */}
            {loadingGames ? (
              <div className="py-20 text-center text-slate-500 font-mono text-sm">
                SYNCHRONIZING VERIFIED PLATFORMS...
              </div>
            ) : games.length === 0 ? (
              <div className="py-16 text-center space-y-2 text-slate-400">
                <Gamepad2 size={36} className="mx-auto text-slate-600" />
                <p className="font-heading text-sm text-white">No games matched your search.</p>
                <p className="text-xs">Try selecting a different category or clearing the search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {games.map((g) => (
                  <GameCard
                    key={g.id}
                    game={g}
                    onPlay={handlePlayGame}
                    onRequestAccount={handleRequestGame}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Platform Trust Highlights */}
          <div className="my-12 grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                <Zap size={20} />
              </div>
              <h3 className="font-heading font-bold text-base text-white">
                Under 5-Minute Cashouts
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Enjoy lightning redemptions directly into Cash App, Chime, Zelle, or Bitcoin with zero hidden fees.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30 flex items-center justify-center font-bold">
                <KeyRound size={20} />
              </div>
              <h3 className="font-heading font-bold text-base text-white">
                1-Click Game Credentials
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Staff issues individual logins for Ultra Panda, Fire Kirin, and Orion Stars with real-time balance loading.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--neon-purple)]/20 text-[var(--neon-purple-light)] border border-[var(--neon-purple)]/30 flex items-center justify-center font-bold">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-heading font-bold text-base text-white">
                100% US Legal Sweepstakes
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Operated strictly under United States promotional sweepstakes frameworks with verified cryptographic fairness.
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <CyberFooter />
      </div>

      {/* Mobile Bottom Dock */}
      <CyberMobileBottomNav
        user={user}
        onOpenAuth={(tab) => setAuthModal({ open: true, tab })}
        onOpenWallet={(tab) => setWalletModal({ open: true, tab })}
        onOpenGameRequest={() => handleRequestGame()}
        onOpenSpinWheel={() => setSpinWheelOpen(true)}
      />

      {/* Daily Lucky Spin Wheel Modal */}
      <DailySpinWheelModal
        isOpen={spinWheelOpen}
        onClose={() => setSpinWheelOpen(false)}
        user={user}
        onBalanceUpdated={loadUser}
      />


      {/* Modals */}
      <AuthModal
        isOpen={authModal.open}
        onClose={() => setAuthModal({ open: false, tab: 'login' })}
        initialTab={authModal.tab}
        onSuccess={(loggedUser) => {
          setUser(loggedUser);
          loadUser();
        }}
      />

      <WalletModal
        isOpen={walletModal.open}
        onClose={() => setWalletModal({ open: false, tab: 'deposit' })}
        initialTab={walletModal.tab}
        user={user}
        onBalanceUpdated={loadUser}
      />

      <GameRequestModal
        isOpen={gameRequestModal.open}
        onClose={() => setGameRequestModal({ open: false, initialGame: null })}
        initialGame={gameRequestModal.initialGame}
        user={user}
        onRequestCreated={loadUser}
        onOpenAuth={(tab) => setAuthModal({ open: true, tab })}
      />

      <DailyBonusModal
        isOpen={dailyBonusOpen}
        onClose={() => setDailyBonusOpen(false)}
        user={user}
        onBonusClaimed={loadUser}
        onOpenAuth={(tab) => setAuthModal({ open: true, tab })}
      />

      <NotificationsModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        user={user}
      />

      <ExternalGameModal
        isOpen={!!activeExternalGame}
        onClose={() => setActiveExternalGame(null)}
        game={activeExternalGame}
        user={user}
        onRequestAccount={handleRequestGame}
        onOpenAuth={(tab) => setAuthModal({ open: true, tab })}
      />

      {/* Playable In-House Game Modals */}
      <Panda777SlotsModal
        isOpen={slotsOpen}
        onClose={() => setSlotsOpen(false)}
        user={user}
        onBalanceUpdated={loadUser}
      />

      <CyberCrashModal
        isOpen={crashOpen}
        onClose={() => setCrashOpen(false)}
        user={user}
        onBalanceUpdated={loadUser}
      />

      {/* Push Notifications & Real-Time Broadcast Toast */}
      <PushNotificationManager />
      <BonusAlertToast />

      {/* Promos & Broadcasts Modal */}
      <SubscriptionPromoModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        user={user}
        onSubscribed={loadUser}
      />

      {/* KYC Verification Modal */}
      <KycModal
        isOpen={kycOpen}
        onClose={() => setKycOpen(false)}
        user={user}
        onSuccess={loadUser}
      />

      {/* Sweepstakes Coin Allotment Modal */}
      <LoadCoinsModal
        isOpen={loadCoinsModal.open}
        onClose={() => setLoadCoinsModal({ open: false, game: null })}
        game={loadCoinsModal.game}
        user={user}
        onSuccess={loadUser}
        onOpenDeposit={() => setWalletModal({ open: true, tab: 'deposit' })}
      />
    </div>
  );
}
