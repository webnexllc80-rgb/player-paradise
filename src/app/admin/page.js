'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ShieldAlert,
  Users,
  Wallet,
  KeyRound,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  TrendingUp,
  Settings,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  RefreshCw,
  LogOut,
  Sparkles,
  Lock,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Plus
} from 'lucide-react';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [stats, setStats] = useState(null);
  const [requests, setRequests] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [methods, setMethods] = useState([]);

  // Form states for approving
  const [approvalInputs, setApprovalInputs] = useState({});
  const [allotmentForm, setAllotmentForm] = useState({ targetUser: '', amountSC: '', amountGC: '', actionType: 'CREDIT', notes: '' });
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    setStatusMsg({ type: '', text: '' });
    try {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();

      if (!meData.authenticated || !meData.user || meData.user.role === 'player') {
        router.push('/');
        return;
      }
      setUser(meData.user);

      // Load all admin modules
      const [statsRes, reqRes, depRes, withRes, usersRes, methRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/account-requests?status=all'),
        fetch('/api/payments/deposit?status=all'),
        fetch('/api/payments/withdraw?status=all'),
        fetch('/api/admin/users'),
        fetch('/api/payments/methods'),
      ]);

      const [statsData, reqData, depData, withData, usersData, methData] = await Promise.all([
        statsRes.json(),
        reqRes.json(),
        depRes.json(),
        withRes.json(),
        usersRes.json(),
        methRes.json(),
      ]);

      if (statsData.success) setStats(statsData.stats);
      if (reqData.success) setRequests(reqData.accountRequests || []);
      if (depData.success) setDeposits(depData.deposits || []);
      if (withData.success) setWithdrawals(withData.redemptions || []);
      if (usersData.success) setUsersList(usersData.users || []);
      if (methData.success) setMethods(methData.methods || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Action: Approve or Reject Game Request
  const handleGameRequestAction = async (id, action) => {
    const inputs = approvalInputs[id] || {};
    try {
      const res = await fetch('/api/account-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          action,
          gameAccountUsername: inputs.username || '',
          gameAccountPassword: inputs.password || '',
          rejectionReason: inputs.reason || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Action failed.');
      setStatusMsg({ type: 'success', text: data.message });
      loadData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  // Action: Approve or Reject Deposit
  const handleDepositAction = async (depositId, action) => {
    try {
      const res = await fetch('/api/payments/deposit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Action failed.');
      setStatusMsg({ type: 'success', text: data.message });
      loadData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  // Action: Approve or Reject Withdrawal
  const handleWithdrawalAction = async (redemptionId, action) => {
    try {
      const res = await fetch('/api/payments/withdraw', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redemptionId, action }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Action failed.');
      setStatusMsg({ type: 'success', text: data.message });
      loadData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  // Action: Balance Allotment
  const handleAllotmentSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/coins/allotment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allotmentForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Allotment failed.');
      setStatusMsg({ type: 'success', text: data.message });
      setAllotmentForm({ targetUser: '', amountSC: '', amountGC: '', actionType: 'CREDIT', notes: '' });
      loadData();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    }
  };

  // Action: Toggle ban user
  const handleToggleBan = async (userId, currentBanned) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isBanned: !currentBanned }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg({ type: 'success', text: 'User status updated.' });
        loadData();
      }
    } catch {}
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: TrendingUp },
    { id: 'requests', label: 'Game Requests', icon: KeyRound, count: requests.filter((r) => r.status === 'PENDING').length },
    { id: 'deposits', label: 'Deposits', icon: ArrowDownLeft, count: deposits.filter((d) => d.status === 'PENDING').length },
    { id: 'withdrawals', label: 'Redemptions', icon: ArrowUpRight, count: withdrawals.filter((w) => w.status === 'PENDING').length },
    { id: 'users', label: 'Players', icon: Users, count: usersList.length },
    { id: 'coins', label: 'Balance Adjuster', icon: DollarSign },
    { id: 'gateways', label: 'Payment Gateways', icon: CreditCard },
  ];

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw size={28} className="animate-spin text-[var(--neon-cyan)] mx-auto" />
          <p className="font-heading font-bold text-sm">AUTHENTICATING COMMAND CONSOLE...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060814] text-white flex flex-col">
      {/* Top Admin Bar */}
      <header className="h-16 border-b border-rose-500/30 bg-rose-950/20 px-4 md:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-[0_0_15px_rgba(244,63,94,0.5)]">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h1 className="font-heading font-black text-sm md:text-base text-white tracking-wider">
              PLAYERS PARADISE • <span className="text-rose-400">ADMIN CONTROL CENTER</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              LOGGED IN AS: <strong className="text-rose-300">{user?.username}</strong> ({user?.role?.toUpperCase()})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
            title="Refresh All"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => router.push('/')}
            className="cyber-btn-outline text-xs py-1.5 px-3"
          >
            RETURN TO HUB
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        {/* Status Message */}
        {statusMsg.text && (
          <div
            className={`p-3.5 rounded-2xl border flex items-center gap-2 text-xs ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                : 'bg-rose-950/70 border-rose-500/60 text-rose-200'
            }`}
          >
            {statusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-heading font-bold text-xs whitespace-nowrap transition-all ${
                  isCurrent
                    ? 'bg-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                    : 'bg-slate-900/80 border border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px]">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-sub font-bold text-slate-400">TOTAL PLAYERS</span>
                <div className="font-heading font-black text-2xl text-white">
                  {stats?.totalUsers || 0}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-sub font-bold text-slate-400">TOTAL DEPOSITED</span>
                <div className="font-heading font-black text-2xl text-emerald-400">
                  ${(stats?.totalDeposited || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-sub font-bold text-slate-400">TOTAL WITHDRAWN</span>
                <div className="font-heading font-black text-2xl text-rose-400">
                  ${(stats?.totalWithdrawn || 0).toLocaleString()}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
                <span className="text-[11px] font-sub font-bold text-slate-400">NET REVENUE</span>
                <div className="font-heading font-black text-2xl text-[var(--neon-cyan)]">
                  ${(stats?.netRevenue || 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Quick action boxes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                onClick={() => setActiveTab('requests')}
                className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 hover:border-amber-500 cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <KeyRound size={22} className="text-amber-400" />
                  <span className="font-mono font-black text-xl text-amber-400">
                    {requests.filter((r) => r.status === 'PENDING').length}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-sm text-white">Pending Game Requests</h3>
                <p className="text-xs text-slate-400">Issue usernames & passwords for Ultra Panda, Fire Kirin, etc.</p>
              </div>

              <div
                onClick={() => setActiveTab('deposits')}
                className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 hover:border-emerald-500 cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <ArrowDownLeft size={22} className="text-emerald-400" />
                  <span className="font-mono font-black text-xl text-emerald-400">
                    {deposits.filter((d) => d.status === 'PENDING').length}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-sm text-white">Pending Deposits</h3>
                <p className="text-xs text-slate-400">Review Cash App receipts and credit player balances.</p>
              </div>

              <div
                onClick={() => setActiveTab('withdrawals')}
                className="p-5 rounded-2xl bg-purple-950/20 border border-purple-500/30 hover:border-purple-500 cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <ArrowUpRight size={22} className="text-purple-400" />
                  <span className="font-mono font-black text-xl text-purple-400">
                    {withdrawals.filter((w) => w.status === 'PENDING').length}
                  </span>
                </div>
                <h3 className="font-heading font-bold text-sm text-white">Pending Redemptions</h3>
                <p className="text-xs text-slate-400">Dispatch Cash App and Crypto payouts to players.</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GAME REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <h2 className="font-heading font-black text-lg text-white">
              GAME ACCOUNT LOGIN REQUESTS ({requests.length})
            </h2>

            {requests.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No game account requests logged.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((r) => {
                  const input = approvalInputs[r.id] || {};
                  return (
                    <div
                      key={r.id}
                      className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-heading font-bold text-sm text-white">
                            {r.gameTitle}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            • Player: <strong className="text-slate-200">{r.userEmail}</strong>
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            r.status === 'READY'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : r.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>

                      {r.status === 'PENDING' ? (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800">
                          <input
                            type="text"
                            placeholder="Assign Username (e.g. PandaPlayer_102)"
                            value={input.username || ''}
                            onChange={(e) =>
                              setApprovalInputs({
                                ...approvalInputs,
                                [r.id]: { ...input, username: e.target.value },
                              })
                            }
                            className="cyber-input text-xs py-1.5"
                          />
                          <input
                            type="text"
                            placeholder="Assign Password (e.g. Pass#9821)"
                            value={input.password || ''}
                            onChange={(e) =>
                              setApprovalInputs({
                                ...approvalInputs,
                                [r.id]: { ...input, password: e.target.value },
                              })
                            }
                            className="cyber-input text-xs py-1.5"
                          />
                          <button
                            onClick={() => handleGameRequestAction(r.id, 'APPROVE')}
                            className="cyber-btn-cyan text-xs py-1.5 font-bold"
                          >
                            <CheckCircle2 size={14} />
                            <span>APPROVE & DISPATCH ID</span>
                          </button>
                          <button
                            onClick={() => handleGameRequestAction(r.id, 'REJECT')}
                            className="p-2 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-bold hover:bg-rose-900/60 transition-colors"
                          >
                            REJECT
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 font-mono">
                          Credentials: Username: <strong className="text-white">{r.gameAccountUsername}</strong> | Password: <strong className="text-amber-300">{r.gameAccountPassword}</strong>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DEPOSITS */}
        {activeTab === 'deposits' && (
          <div className="space-y-4">
            <h2 className="font-heading font-black text-lg text-white">
              DEPOSIT TRANSACTIONS ({deposits.length})
            </h2>

            {deposits.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No deposits submitted yet.</p>
            ) : (
              <div className="space-y-3">
                {deposits.map((d) => (
                  <div
                    key={d.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-emerald-400">
                          ${parseFloat(d.amount).toFixed(2)}
                        </span>
                        <span className="text-xs text-slate-300">
                          via <strong className="text-white">{d.method}</strong>
                        </span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-300">Player: {d.email}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          d.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : d.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400">
                      Note / Reference: <strong className="text-slate-200">{d.referenceNumber || 'N/A'}</strong>
                      {d.promoCode && <span className="ml-3 text-amber-400 font-bold">Promo: {d.promoCode}</span>}
                    </div>

                    {d.status === 'PENDING' && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleDepositAction(d.id, 'APPROVE')}
                          className="cyber-btn-cyan text-xs py-1.5 px-4 font-bold"
                        >
                          <CheckCircle2 size={14} />
                          <span>APPROVE & CREDIT BALANCE</span>
                        </button>
                        <button
                          onClick={() => handleDepositAction(d.id, 'REJECT')}
                          className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-bold"
                        >
                          REJECT
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: WITHDRAWALS */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-4">
            <h2 className="font-heading font-black text-lg text-white">
              REDEMPTION CASHOUT REQUESTS ({withdrawals.length})
            </h2>

            {withdrawals.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No cashout requests logged.</p>
            ) : (
              <div className="space-y-3">
                {withdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-base text-rose-400">
                          ${parseFloat(w.amount).toFixed(2)} SC
                        </span>
                        <span className="text-xs text-slate-300">
                          via <strong className="text-white">{w.method}</strong>
                        </span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-300">Destination: <strong className="text-amber-300">{w.destinationTag}</strong></span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          w.status === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : w.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {w.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400">
                      Player: <strong className="text-white">{w.username}</strong> ({w.email})
                    </div>

                    {w.status === 'PENDING' && (
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                        <button
                          onClick={() => handleWithdrawalAction(w.id, 'APPROVE')}
                          className="px-4 py-1.5 rounded-xl bg-emerald-500 text-black font-heading font-bold text-xs shadow-md"
                        >
                          MARK AS PAID & DISPATCHED
                        </button>
                        <button
                          onClick={() => handleWithdrawalAction(w.id, 'REJECT')}
                          className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs font-bold"
                        >
                          REJECT & REFUND TO PLAYER
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: USERS */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-black text-lg text-white">
                PLAYER ACCOUNTS ({usersList.length})
              </h2>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 font-sub font-bold text-slate-400">
                  <tr>
                    <th className="p-3">USERNAME</th>
                    <th className="p-3">EMAIL</th>
                    <th className="p-3">ROLE</th>
                    <th className="p-3">SC BALANCE</th>
                    <th className="p-3">GC BALANCE</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold text-white">{u.username}</td>
                      <td className="p-3 text-slate-300">{u.email}</td>
                      <td className="p-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] uppercase font-mono">
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        ${Number(u.balanceSC || 0).toFixed(2)}
                      </td>
                      <td className="p-3 font-mono text-purple-300">
                        {Number(u.balanceGC || 0).toLocaleString()}
                      </td>
                      <td className="p-3">
                        {u.isBanned ? (
                          <span className="text-rose-400 font-bold">BANNED</span>
                        ) : (
                          <span className="text-emerald-400 font-bold">ACTIVE</span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleToggleBan(u.id, u.isBanned)}
                          className="text-[10px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                        >
                          {u.isBanned ? 'UNBAN' : 'BAN'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: COINS ALLOTMENT */}
        {activeTab === 'coins' && (
          <div className="max-w-xl mx-auto p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="font-heading font-black text-lg text-white">
              MANUAL BALANCE ADJUSTMENT (CREDIT / DEBIT)
            </h2>
            <p className="text-xs text-slate-400">
              Directly credit or debit Sweeps Cash (SC) and Game Coins (GC) to any player.
            </p>

            <form onSubmit={handleAllotmentSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
                  PLAYER USERNAME OR EMAIL
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. demo_player or player@demo.com"
                  value={allotmentForm.targetUser}
                  onChange={(e) => setAllotmentForm({ ...allotmentForm, targetUser: e.target.value })}
                  className="cyber-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
                    ACTION TYPE
                  </label>
                  <select
                    value={allotmentForm.actionType}
                    onChange={(e) => setAllotmentForm({ ...allotmentForm, actionType: e.target.value })}
                    className="cyber-input bg-slate-950"
                  >
                    <option value="CREDIT">CREDIT (+ Add)</option>
                    <option value="DEBIT">DEBIT (- Deduct)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
                    SC AMOUNT
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={allotmentForm.amountSC}
                    onChange={(e) => setAllotmentForm({ ...allotmentForm, amountSC: e.target.value })}
                    className="cyber-input font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
                  GC AMOUNT (GAME COINS)
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="0"
                  value={allotmentForm.amountGC}
                  onChange={(e) => setAllotmentForm({ ...allotmentForm, amountGC: e.target.value })}
                  className="cyber-input font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
                  REASON / AUDIT NOTE
                </label>
                <input
                  type="text"
                  placeholder="e.g. Promotional bonus credit"
                  value={allotmentForm.notes}
                  onChange={(e) => setAllotmentForm({ ...allotmentForm, notes: e.target.value })}
                  className="cyber-input"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl font-heading font-black text-sm tracking-wider bg-rose-600 text-white shadow-lg hover:bg-rose-500 transition-colors"
              >
                APPLY BALANCE ADJUSTMENT
              </button>
            </form>
          </div>
        )}

        {/* TAB 7: GATEWAYS */}
        {activeTab === 'gateways' && (
          <div className="space-y-4">
            <h2 className="font-heading font-black text-lg text-white">
              CONFIGURED PAYMENT GATEWAYS
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {methods.map((m) => (
                <div
                  key={m.id || m.methodId}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold text-base text-white">{m.name}</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">
                      ACTIVE
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 font-mono text-xs text-[var(--neon-cyan)]">
                    {m.tag}
                  </div>
                  <p className="text-xs text-slate-400">{m.instructions}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
