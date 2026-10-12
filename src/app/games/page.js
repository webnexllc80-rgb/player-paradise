'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CyberNavbar from '@/components/navigation/CyberNavbar';
import CyberSidebar from '@/components/navigation/CyberSidebar';
import CyberMobileBottomNav from '@/components/navigation/CyberMobileBottomNav';
import CyberFooter from '@/components/common/CyberFooter';
import GameCard from '@/components/hub/GameCard';
import AuthModal from '@/components/modals/AuthModal';
import WalletModal from '@/components/modals/WalletModal';
import GameRequestModal from '@/components/modals/GameRequestModal';
import ExternalGameModal from '@/components/modals/ExternalGameModal';
import Panda777SlotsModal from '@/components/games/Panda777SlotsModal';
import CyberCrashModal from '@/components/games/CyberCrashModal';

import {
  Gamepad2,
  Trophy,
  Search,
  Sparkles
} from 'lucide-react';

export default function GamesPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [games, setGames] = useState([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Modals
  const [authModal, setAuthModal] = useState({ open: false, tab: 'login' });
  const [walletModal, setWalletModal] = useState({ open: false, tab: 'deposit' });
  const [gameRequestModal, setGameRequestModal] = useState({ open: false, initialGame: null });
  const [activeExternalGame, setActiveExternalGame] = useState(null);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [crashOpen, setCrashOpen] = useState(false);

  const loadUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) setUser(data.user);
    } catch {}
  };

  const loadGames = async () => {
    setLoading(true);
    try {
      let url = '/api/games';
      const params = new URLSearchParams();
      if (category !== 'all') params.append('category', category);
      if (search) params.append('search', search);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.games) setGames(data.games);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    loadGames();
  }, [category, search]);

  const handlePlayGame = (game) => {
    if (!user) {
      setAuthModal({ open: true, tab: 'login' });
      return;
    }
    if (game.id === 'panda-777-slots') setSlotsOpen(true);
    else if (game.id === 'cyber-matrix-crash') setCrashOpen(true);
    else setActiveExternalGame(game);
  };

  const handleRequestGame = (game = null) => {
    if (!user) {
      setAuthModal({ open: true, tab: 'login' });
      return;
    }
    setGameRequestModal({ open: true, initialGame: game });
  };

  const categories = [
    { id: 'all', label: 'All Catalog', icon: '🌟' },
    { id: 'sweeps', label: 'Web Sweeps', icon: '🎰' },
    { id: 'fish', label: 'Fish Arcade', icon: '🐟' },
    { id: 'slots', label: 'Cyber Slots', icon: '⚡' },
    { id: 'crash', label: 'Crash Matrix', icon: '🚀' },
    { id: 'table', label: 'Table VIP', icon: '🃏' },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-white flex flex-col">
      <CyberSidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        user={user}
        onOpenWallet={(tab) => setWalletModal({ open: true, tab })}
        onOpenGameRequest={() => handleRequestGame()}
        onOpenChat={() => {}}
        onOpenDailyBonus={() => {}}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <CyberNavbar
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          user={user}
          onOpenAuth={(tab) => setAuthModal({ open: true, tab })}
          onOpenWallet={(tab) => setWalletModal({ open: true, tab })}
          onOpenDailyBonus={() => {}}
          onOpenNotifications={() => {}}
          onLogout={() => {
            fetch('/api/auth/logout', { method: 'POST' });
            setUser(null);
          }}
        />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Trophy size={22} className="text-[var(--neon-cyan)]" />
                <h1 className="font-heading font-black text-2xl md:text-3xl text-white">
                  ALL VERIFIED GAMES & REELS
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Browse official sweepstakes machines, fish hunter tables, and cyber arcade titles
              </p>
            </div>

            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="Search platforms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="cyber-input pl-9 py-2 text-xs"
              />
              <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
            </div>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-heading font-bold whitespace-nowrap transition-all ${
                  category === cat.id
                    ? 'bg-gradient-to-r from-[var(--neon-cyan)] to-blue-500 text-black shadow-md'
                    : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <p className="text-xs text-center text-slate-500 py-16">LOADING GAMES CATALOG...</p>
          ) : games.length === 0 ? (
            <p className="text-xs text-center text-slate-400 py-16">No games found in this category.</p>
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
        </main>

        <CyberFooter />
      </div>

      <CyberMobileBottomNav
        user={user}
        onOpenAuth={(tab) => setAuthModal({ open: true, tab })}
        onOpenWallet={(tab) => setWalletModal({ open: true, tab })}
        onOpenGameRequest={() => handleRequestGame()}
      />

      <AuthModal
        isOpen={authModal.open}
        onClose={() => setAuthModal({ open: false, tab: 'login' })}
        onSuccess={() => loadUser()}
      />

      <WalletModal
        isOpen={walletModal.open}
        onClose={() => setWalletModal({ open: false, tab: 'deposit' })}
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

      <ExternalGameModal
        isOpen={!!activeExternalGame}
        onClose={() => setActiveExternalGame(null)}
        game={activeExternalGame}
        user={user}
        onRequestAccount={handleRequestGame}
        onOpenAuth={(tab) => setAuthModal({ open: true, tab })}
      />

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
    </div>
  );
}
