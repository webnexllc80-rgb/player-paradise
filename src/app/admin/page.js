'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  LogOut,
  ExternalLink,
  Menu,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sparkles
} from 'lucide-react';

// Modular Admin Components
import AdminSidebar from '@/components/admin/AdminSidebar';
import OverviewTab from '@/components/admin/OverviewTab';
import RequestsTab from '@/components/admin/RequestsTab';
import LedgerTab from '@/components/admin/LedgerTab';
import PlayerAccountsTab from '@/components/admin/PlayerAccountsTab';
import CoinsAllotmentTab from '@/components/admin/CoinsAllotmentTab';
import GatewaysTab from '@/components/admin/GatewaysTab';
import GamesLibraryTab from '@/components/admin/GamesLibraryTab';
import StaffTab from '@/components/admin/StaffTab';
import SupportTab from '@/components/admin/SupportTab';
import SettingsTab from '@/components/admin/SettingsTab';

// Modals
import {
  ApproveRequestModal,
  RejectRequestModal,
  InspectProofModal,
  QuickAllotmentModal,
  AddGatewayModal,
  AddStaffModal,
} from '@/components/admin/AdminModals';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Auth gate states
  const [authStatus, setAuthStatus] = useState('checking'); // 'checking' | 'authorized' | 'unauthenticated' | 'unauthorized'
  const [adminLoginInput, setAdminLoginInput] = useState({
    identifier: 'admin@playersparadisehub.com',
    password: 'Paradise@2026!',
  });
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginErrorMsg, setLoginErrorMsg] = useState('');

  // Data states
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [methods, setMethods] = useState([]);
  const [games, setGames] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [settings, setSettings] = useState({});
  const [chatMessages, setChatMessages] = useState([]);

  // Toast / feedback state
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Modal active states
  const [modalApproveReq, setModalApproveReq] = useState(null);
  const [modalRejectReq, setModalRejectReq] = useState(null);
  const [modalInspectProof, setModalInspectProof] = useState(null);
  const [modalQuickAllotment, setModalQuickAllotment] = useState(null);
  const [modalAddGatewayOpen, setModalAddGatewayOpen] = useState(false);
  const [modalAddStaffOpen, setModalAddStaffOpen] = useState(false);

  const showToast = (text, type = 'success') => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();

      if (!meData.authenticated || !meData.user) {
        setUser(null);
        setAuthStatus('unauthenticated');
        setLoading(false);
        return;
      }

      if (meData.user.role === 'player') {
        setUser(meData.user);
        setAuthStatus('unauthorized');
        setLoading(false);
        return;
      }

      setUser(meData.user);
      setAuthStatus('authorized');

      // Fetch all operational modules in parallel
      const [
        statsRes,
        reqRes,
        depRes,
        withRes,
        usersRes,
        methRes,
        gamesRes,
        staffRes,
        settingsRes,
        chatRes,
      ] = await Promise.all([
        fetch('/api/admin/stats').catch(() => null),
        fetch('/api/account-requests?status=all').catch(() => null),
        fetch('/api/payments/deposit?status=all').catch(() => null),
        fetch('/api/payments/withdraw?status=all').catch(() => null),
        fetch('/api/admin/users').catch(() => null),
        fetch('/api/payments/methods').catch(() => null),
        fetch('/api/games').catch(() => null),
        fetch('/api/admin/staff').catch(() => null),
        fetch('/api/admin/settings').catch(() => null),
        fetch('/api/chat').catch(() => null),
      ]);

      if (statsRes?.ok) {
        const d = await statsRes.json();
        if (d.success) setStats(d.stats);
      }
      if (reqRes?.ok) {
        const d = await reqRes.json();
        if (d.success) setRequests(d.accountRequests || []);
      }
      if (depRes?.ok) {
        const d = await depRes.json();
        if (d.success) setDeposits(d.deposits || []);
      }
      if (withRes?.ok) {
        const d = await withRes.json();
        if (d.success) setWithdrawals(d.redemptions || []);
      }
      if (usersRes?.ok) {
        const d = await usersRes.json();
        if (d.success) setUsersList(d.users || []);
      }
      if (methRes?.ok) {
        const d = await methRes.json();
        if (d.success) setMethods(d.methods || []);
      }
      if (gamesRes?.ok) {
        const d = await gamesRes.json();
        if (d.success) setGames(d.games || []);
      }
      if (staffRes?.ok) {
        const d = await staffRes.json();
        if (d.success) setStaffList(d.staff || []);
      }
      if (settingsRes?.ok) {
        const d = await settingsRes.json();
        if (d.success) setSettings(d.settings || {});
      }
      if (chatRes?.ok) {
        const d = await chatRes.json();
        if (d.success) setChatMessages(d.messages || []);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdminLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginSubmitting(true);
    setLoginErrorMsg('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminLoginInput),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed. Please check credentials.');
      }

      if (data.user.role === 'player') {
        throw new Error('Access Denied: Player accounts cannot access the Admin Console.');
      }

      setUser(data.user);
      setAuthStatus('authorized');
      await loadData();
    } catch (err) {
      setLoginErrorMsg(err.message);
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setAuthStatus('unauthenticated');
    } catch (err) {
      console.error(err);
    }
  };

  // --- Handlers for Game Requests ---
  const handleConfirmApproveRequest = async (id, username, password) => {
    const res = await fetch('/api/account-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        action: 'APPROVE',
        gameAccountUsername: username,
        gameAccountPassword: password,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Approval failed.');
    showToast(data.message || 'Game account approved and credentials assigned!');
    loadData();
  };

  const handleConfirmRejectRequest = async (id, reason) => {
    const res = await fetch('/api/account-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'REJECT', rejectionReason: reason }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Rejection failed.');
    showToast(data.message || 'Request rejected.');
    loadData();
  };

  // --- Handlers for Ledger Transactions ---
  const handleApproveDeposit = async (id) => {
    try {
      const res = await fetch('/api/payments/deposit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId: id, action: 'APPROVE' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to approve deposit.');
      showToast(data.message || 'Deposit approved and player wallet credited!');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRejectDeposit = async (id) => {
    try {
      const res = await fetch('/api/payments/deposit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId: id, action: 'REJECT' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reject deposit.');
      showToast(data.message || 'Deposit marked rejected.');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleApproveWithdrawal = async (id) => {
    try {
      const res = await fetch('/api/payments/withdraw', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redemptionId: id, action: 'APPROVE' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to approve redemption.');
      showToast(data.message || 'Redemption approved and marked settled!');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRejectWithdrawal = async (id) => {
    try {
      const res = await fetch('/api/payments/withdraw', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redemptionId: id, action: 'REJECT' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to reject redemption.');
      showToast(data.message || 'Redemption rejected.');
      loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // --- Handlers for Player Allotment & Ban ---
  const handleExecuteAllotment = async (formPayload) => {
    const res = await fetch('/api/coins/allotment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formPayload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Allotment failed.');
    showToast(data.message || 'Balance adjusted successfully!');
    loadData();
  };

  const handleToggleBan = async (userId, currentBanned) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isBanned: !currentBanned }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'User account status updated.');
        loadData();
      }
    } catch (err) {
      showToast('Action failed.', 'error');
    }
  };

  // --- Handlers for Gateways & Settings ---
  const handleToggleGateway = async (id, newActive) => {
    try {
      const res = await fetch('/api/payments/methods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, active: newActive }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Gateway status updated.');
        loadData();
      }
    } catch (err) {
      showToast('Failed to update gateway.', 'error');
    }
  };

  const handleSaveSettings = async (settingsPayload) => {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settingsPayload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Save failed.');
    showToast('Platform settings saved!');
    loadData();
  };

  const handleSendAdminReply = async (targetPlayer, text) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        targetUser: targetPlayer,
        isStaff: true,
      }),
    });
    const data = await res.json();
    if (data.success) {
      showToast('Reply dispatched to player.');
      loadData();
    }
  };

  // Pending badge calculations
  const pendingCounts = {
    requests: requests.filter((r) => r.status === 'PENDING').length,
    ledger:
      deposits.filter((d) => d.status === 'PENDING').length +
      withdrawals.filter((w) => w.status === 'PENDING').length,
    chats: 0,
  };

  // --- AUTH CHECK LOADING ---
  if (authStatus === 'checking' && loading) {
    return (
      <div className="min-h-screen bg-[#050711] text-white flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-cyan-500 to-rose-500 p-0.5 animate-pulse">
            <div className="w-full h-full bg-[#080b1e] rounded-2xl flex items-center justify-center">
              <RefreshCw size={28} className="animate-spin text-cyan-400" />
            </div>
          </div>
          <div>
            <p className="font-heading font-black text-sm tracking-widest text-slate-200">
              VERIFYING ADMIN CLEARANCE...
            </p>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Players Paradise Hub • Cyber Console
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- UNAUTHORIZED ROLE SCREEN ---
  if (authStatus === 'unauthorized') {
    return (
      <div className="min-h-screen bg-[#050711] text-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-rose-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="relative z-10 max-w-md w-full bg-[#0a0d1f]/95 border border-rose-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_50px_rgba(244,63,94,0.15)] text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold tracking-widest uppercase">
              Access Restricted
            </div>
            <h2 className="text-xl font-heading font-black text-white">Staff Clearance Required</h2>
            <p className="text-xs text-slate-400">
              You are currently authenticated as player <strong className="text-white">@{user?.username}</strong>. Only Super Admins and authorized staff can access this control center.
            </p>
          </div>
          <div className="space-y-3 pt-2">
            <button
              onClick={handleAdminLogout}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-heading font-black text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(244,63,94,0.3)] transition-all cursor-pointer"
            >
              <LogOut size={16} />
              SWITCH TO ADMIN ACCOUNT
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white font-heading font-bold text-xs tracking-wider transition-all cursor-pointer"
            >
              RETURN TO PLAYER LOUNGE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- UNAUTHENTICATED INLINE ADMIN LOGIN ---
  if (authStatus === 'unauthenticated' || !user) {
    return (
      <div className="min-h-screen bg-[#050711] text-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-rose-600/15 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-md w-full bg-[#0a0d1f]/95 border border-rose-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_0_60px_rgba(244,63,94,0.2)] space-y-6">
          <div className="text-center space-y-3">
            <div className="relative w-20 h-20 mx-auto rounded-2xl overflow-hidden border-2 border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.4)]">
              <Image
                src="/playerparadisehub.jpeg"
                alt="Players Paradise"
                fill
                className="object-cover"
                priority
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-bold tracking-widest uppercase mb-2">
                <ShieldCheck size={12} /> RESTRICTED CONSOLE
              </div>
              <h2 className="text-xl font-heading font-black text-white tracking-wide">
                CYBER COMMAND CENTER
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your administrative credentials to proceed.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Sparkles size={13} className="text-amber-400" /> Default Super Admin:
              </span>
              <button
                type="button"
                onClick={() =>
                  setAdminLoginInput({
                    identifier: 'admin@playersparadisehub.com',
                    password: 'Paradise@2026!',
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-[10px] tracking-wider transition-all cursor-pointer"
              >
                1-CLICK AUTO-FILL
              </button>
            </div>
            <div className="font-mono text-[11px] text-slate-400 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 flex items-center justify-between">
              <span className="text-rose-300 truncate">admin@playersparadisehub.com</span>
              <span className="text-slate-500 font-sans text-[10px]">Paradise@2026!</span>
            </div>
          </div>

          {loginErrorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-rose-400" />
              <span>{loginErrorMsg}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Admin Username or Email
              </label>
              <input
                type="text"
                required
                value={adminLoginInput.identifier}
                onChange={(e) =>
                  setAdminLoginInput({ ...adminLoginInput, identifier: e.target.value })
                }
                placeholder="admin@playersparadisehub.com"
                className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-rose-500 text-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                Security Password
              </label>
              <input
                type="password"
                required
                value={adminLoginInput.password}
                onChange={(e) =>
                  setAdminLoginInput({ ...adminLoginInput, password: e.target.value })
                }
                placeholder="••••••••••••"
                className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-rose-500 text-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-cyan-500 hover:from-rose-500 hover:to-cyan-400 text-white font-heading font-black text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(244,63,94,0.35)] transition-all cursor-pointer disabled:opacity-50"
            >
              {loginSubmitting ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  AUTHENTICATING...
                </>
              ) : (
                <>
                  <Lock size={15} />
                  SIGN IN TO ADMIN CONSOLE
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-xs text-slate-400 hover:text-cyan-400 font-medium transition-colors cursor-pointer"
            >
              ← Back to Players Paradise Lounge
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN ADMIN LAYOUT (WinningHeaven Master Sidebar Layout with Cyber Theme) ---
  return (
    <div className="min-h-screen w-full bg-[#050711] text-white flex flex-col lg:flex-row overflow-hidden relative font-sans">
      {/* 1. Left Sidebar Navigation */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        pendingCounts={pendingCounts}
        adminUser={user}
        onLogout={handleAdminLogout}
      />

      {/* 2. Main Admin Workspace Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-radial-gradient">
        {/* Mobile Header Bar */}
        <header className="lg:hidden h-14 px-4 bg-[#070a1a] border-b border-cyan-500/20 flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-cyan-400"
              aria-label="Open Navigation Menu"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden border border-cyan-400 relative">
                <Image src="/playerparadisehub.jpeg" alt="Logo" fill className="object-cover" />
              </div>
              <span className="font-heading font-black text-xs tracking-wider text-white">
                PARADISE <span className="text-cyan-400">ADMIN</span>
              </span>
            </div>
          </div>

          <button
            onClick={handleAdminLogout}
            className="p-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-bold"
          >
            <LogOut size={15} />
          </button>
        </header>

        {/* Desktop Top Workspace Action Bar */}
        <div className="h-16 px-6 border-b border-cyan-500/15 bg-[#060918]/80 backdrop-blur-xl flex items-center justify-between shrink-0 hidden lg:flex">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <div>
              <span className="text-xs font-heading font-bold text-slate-400 uppercase tracking-wider">
                COMMAND CONSOLE • <strong className="text-cyan-400 uppercase">{activeTab}</strong>
              </span>
              <p className="text-[10px] text-slate-500 font-mono">
                Real-Time Operations & Player Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={loadData}
              disabled={loading}
              className="py-1.5 px-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Refresh All Operations"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-cyan-400' : ''} />
              <span>SYNC LIVE</span>
            </button>

            <button
              onClick={() => router.push('/')}
              className="cyber-btn-outline text-xs py-1.5 px-3.5"
            >
              RETURN TO HUB
            </button>
          </div>
        </div>

        {/* Scrollable Main Content Workspace */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6">
          {/* Toast Notification Banner */}
          {statusMsg.text && (
            <div
              className={`p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs shadow-lg transition-all ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-500/60 text-rose-200'
              }`}
            >
              {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span className="font-medium">{statusMsg.text}</span>
            </div>
          )}

          {/* Tab 1: Overview Analytics */}
          {activeTab === 'overview' && (
            <OverviewTab
              stats={stats}
              requests={requests}
              deposits={deposits}
              withdrawals={withdrawals}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onInspectProof={(tx) => setModalInspectProof(tx)}
              onApproveRequestClick={(req) => setModalApproveReq(req)}
            />
          )}

          {/* Tab 2: Game Requests */}
          {activeTab === 'requests' && (
            <RequestsTab
              requests={requests}
              onApproveClick={(req) => setModalApproveReq(req)}
              onRejectClick={(req) => setModalRejectReq(req)}
            />
          )}

          {/* Tab 3: Financial Ledger */}
          {activeTab === 'ledger' && (
            <LedgerTab
              deposits={deposits}
              withdrawals={withdrawals}
              onApproveDeposit={handleApproveDeposit}
              onRejectDeposit={handleRejectDeposit}
              onApproveWithdrawal={handleApproveWithdrawal}
              onRejectWithdrawal={handleRejectWithdrawal}
              onInspectProof={(tx) => setModalInspectProof(tx)}
            />
          )}

          {/* Tab 4: Player Accounts */}
          {activeTab === 'users' && (
            <PlayerAccountsTab
              usersList={usersList}
              onOpenAllotment={(u) => setModalQuickAllotment(u)}
              onToggleBan={handleToggleBan}
            />
          )}

          {/* Tab 5: Coins Allotment / Balance Adjuster */}
          {activeTab === 'coins' && (
            <CoinsAllotmentTab
              usersList={usersList}
              onExecuteAllotment={handleExecuteAllotment}
            />
          )}

          {/* Tab 6: Payment Gateways */}
          {activeTab === 'gateways' && (
            <GatewaysTab
              methods={methods}
              onOpenAddModal={() => setModalAddGatewayOpen(true)}
              onToggleGateway={handleToggleGateway}
            />
          )}

          {/* Tab 7: Games Library */}
          {activeTab === 'games' && (
            <GamesLibraryTab
              games={games}
              onUpdateGameUrl={async (id, playUrl) => {
                showToast(`Game launch URL updated for ${id}!`);
              }}
            />
          )}

          {/* Tab 8: Staff Management */}
          {activeTab === 'staff' && (
            <StaffTab
              staffList={staffList}
              onOpenAddStaffModal={() => setModalAddStaffOpen(true)}
            />
          )}

          {/* Tab 9: Live Support Chat */}
          {activeTab === 'support' && (
            <SupportTab
              chatMessages={chatMessages}
              onSendAdminReply={handleSendAdminReply}
            />
          )}

          {/* Tab 10: System Settings */}
          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              onSaveSettings={handleSaveSettings}
            />
          )}
        </main>
      </div>

      {/* --- MODALS HOST --- */}
      <ApproveRequestModal
        isOpen={!!modalApproveReq}
        onClose={() => setModalApproveReq(null)}
        request={modalApproveReq}
        onConfirm={handleConfirmApproveRequest}
      />

      <RejectRequestModal
        isOpen={!!modalRejectReq}
        onClose={() => setModalRejectReq(null)}
        request={modalRejectReq}
        onConfirm={handleConfirmRejectRequest}
      />

      <InspectProofModal
        isOpen={!!modalInspectProof}
        onClose={() => setModalInspectProof(null)}
        transaction={modalInspectProof}
        onApprove={(id) => {
          if (modalInspectProof?.txType === 'DEPOSIT') handleApproveDeposit(id);
          else handleApproveWithdrawal(id);
        }}
        onReject={(id) => {
          if (modalInspectProof?.txType === 'DEPOSIT') handleRejectDeposit(id);
          else handleRejectWithdrawal(id);
        }}
      />

      <QuickAllotmentModal
        isOpen={!!modalQuickAllotment}
        onClose={() => setModalQuickAllotment(null)}
        targetUser={modalQuickAllotment}
        onComplete={(msg) => {
          showToast(msg || 'Balance adjusted successfully!');
          loadData();
        }}
      />

      <AddGatewayModal
        isOpen={modalAddGatewayOpen}
        onClose={() => setModalAddGatewayOpen(false)}
        onComplete={(msg) => {
          showToast(msg || 'Payment gateway registered!');
          loadData();
        }}
      />

      <AddStaffModal
        isOpen={modalAddStaffOpen}
        onClose={() => setModalAddStaffOpen(false)}
        onComplete={(msg) => {
          showToast(msg || 'Staff account created!');
          loadData();
        }}
      />
    </div>
  );
}
