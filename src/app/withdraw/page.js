'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  RefreshCw,
  Coins,
  Send,
} from 'lucide-react';
import CyberNavbar from '@/components/navigation/CyberNavbar';
import CyberSidebar from '@/components/navigation/CyberSidebar';
import CyberMobileBottomNav from '@/components/navigation/CyberMobileBottomNav';
import CyberFooter from '@/components/common/CyberFooter';
import DailySpinWheelModal from '@/components/common/DailySpinWheelModal';

export default function WithdrawPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [spinWheelOpen, setSpinWheelOpen] = useState(false);

  // Withdrawal Form State
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [method, setMethod] = useState('Cash App');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  // History State
  const [withdrawHistory, setWithdrawHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // 1. Fetch current user
  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        router.push('/login?redirect=/withdraw');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUser(false);
    }
  };

  // 2. Fetch withdrawal history
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/payments/withdraw');
      const data = await res.json();
      if (data.success && data.withdrawals) {
        setWithdrawHistory(data.withdrawals);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchHistory();
  }, []);

  const availableBalance = user ? Math.max(0, Number(user.availableSC ?? (user.balanceSC - (user.frozenBalance || 0)) ?? user.balance ?? 0)) : 0;
  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  const handleSubmitWithdraw = async (e) => {
    e.preventDefault();
    if (!finalAmount || finalAmount < 20) {
      setStatusMessage({ type: 'error', text: 'Minimum withdrawal amount is $20.00' });
      return;
    }

    if (finalAmount > availableBalance) {
      setStatusMessage({
        type: 'error',
        text: `Insufficient available balance. You only have $${availableBalance.toFixed(2)} available.`,
      });
      return;
    }

    if (!recipientAccount.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your receiving Cashtag, Wallet, or Account.' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const payload = {
        amount: finalAmount,
        currency: 'SC',
        payoutMethod: method,
        recipientDetails: recipientAccount.trim(),
        destinationTag: recipientAccount.trim(),
      };

      const res = await fetch('/api/payments/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: `Redeem request for $${finalAmount.toFixed(2)} submitted! Desk agents will dispatch your payout shortly.`,
        });
        setRecipientAccount('');
        setCustomAmount('');
        fetchHistory();
        fetchUser();
      } else {
        setStatusMessage({ type: 'error', text: data.message || 'Withdrawal submission failed.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Network error occurred.' });
    } finally {
      setSubmitting(false);
    }
  };

  const payoutMethods = [
    { id: 'cashapp', name: 'Cash App', placeholder: 'e.g. $YourCashtag' },
    { id: 'crypto-btc', name: 'Bitcoin (BTC)', placeholder: 'e.g. bc1q... wallet address' },
    { id: 'crypto-usdt', name: 'USDT (TRC20)', placeholder: 'e.g. TX... TRC20 wallet address' },
    { id: 'venmo', name: 'Venmo', placeholder: 'e.g. @YourVenmoHandle' },
    { id: 'paypal', name: 'PayPal', placeholder: 'e.g. your-email@domain.com' },
    { id: 'zelle', name: 'Zelle Pay', placeholder: 'e.g. phone number or email' },
  ];

  const presetAmounts = [20, 50, 100, 250, 500];

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-white flex flex-col font-sans selection:bg-[var(--neon-cyan)] selection:text-black">
      {/* Collapsible Sidebar */}
      <CyberSidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        user={user}
        onOpenWallet={(tab) => {
          if (tab === 'deposit') router.push('/deposit');
          else router.push('/withdraw');
        }}
        onOpenGameRequest={() => router.push('/games')}
        onOpenChat={() => {}}
        onOpenDailyBonus={() => setSpinWheelOpen(true)}
        onOpenSpinWheel={() => setSpinWheelOpen(true)}
      />

      {/* Main Content Layout with proper lg:pl-64 offset */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        {/* Top Navbar */}
        <CyberNavbar
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          user={user}
          onOpenAuth={(mode) => router.push(`/${mode}`)}
          onOpenWallet={(tab) => {
            if (tab === 'deposit') router.push('/deposit');
            else router.push('/withdraw');
          }}
          onOpenSpinWheel={() => setSpinWheelOpen(true)}
        />

        {/* Center Content Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-[var(--neon-cyan)]/30 bg-gradient-to-r from-blue-950/40 via-slate-900 to-[#0c102b] p-6 sm:p-8 shadow-[0_0_40px_rgba(0,240,255,0.15)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/40 text-[var(--neon-cyan)] text-xs font-bold uppercase tracking-wider mb-2">
                  <ArrowUpRight size={14} />
                  <span>Instant Player Cashout Desk</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight">
                  REDEEM YOUR <span className="text-[var(--neon-cyan)]">WINNINGS</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                  Cash out your balance straight to your CashApp, Crypto, or Venmo. 1:1 USD guaranteed payouts with fast 24/7 processing.
                </p>
              </div>

              {/* Balance Widget Card */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-[var(--neon-cyan)]/40 flex flex-col items-end min-w-[160px]">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">AVAILABLE TO CASHOUT</span>
                <span className="font-mono font-black text-2xl sm:text-3xl text-[var(--neon-cyan)] mt-0.5">
                  ${availableBalance.toFixed(2)}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                  Total Balance: ${Number(user?.balance || user?.balanceSC || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Alert Message */}
          {statusMessage && (
            <div
              className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-semibold transition-all ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200'
                  : 'bg-red-950/70 border-red-500 text-red-200'
              }`}
            >
              {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Form & Info Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Withdrawal Form */}
            <form onSubmit={handleSubmitWithdraw} className="lg:col-span-7 space-y-6">
              {/* Step 1: Select Payout Method */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#0d102b] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-heading font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--neon-cyan)] text-black flex items-center justify-center text-xs font-black">1</span>
                    Select Cashout Destination
                  </h3>
                  <span className="text-xs text-slate-400">Min $20.00</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {payoutMethods.map((m) => {
                    const isSelected = method === m.name;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMethod(m.name)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[var(--neon-cyan)]/15 border-[var(--neon-cyan)] shadow-[0_0_15px_rgba(0,240,255,0.3)]'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-heading font-bold text-white truncate">{m.name}</span>
                          {isSelected && <CheckCircle2 size={14} className="text-[var(--neon-cyan)] flex-shrink-0" />}
                        </div>
                        <span className="text-[10px] text-slate-400">Instant / Fast</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Choose Cashout Amount */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#0d102b] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-heading font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--neon-cyan)] text-black flex items-center justify-center text-xs font-black">2</span>
                    Cashout Amount ($ USD)
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomAmount(availableBalance.toFixed(2));
                    }}
                    className="text-xs font-bold text-[var(--neon-cyan)] hover:underline"
                  >
                    Max All-in (${availableBalance.toFixed(2)})
                  </button>
                </div>

                {/* Amount presets */}
                <div className="grid grid-cols-5 gap-2">
                  {presetAmounts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      disabled={p > availableBalance}
                      onClick={() => {
                        setAmount(p);
                        setCustomAmount('');
                      }}
                      className={`py-3 rounded-xl font-heading font-bold text-sm transition-all ${
                        !customAmount && amount === p
                          ? 'bg-[var(--neon-cyan)] text-black shadow-[0_0_15px_rgba(0,240,255,0.4)]'
                          : p > availableBalance
                          ? 'bg-slate-950 border border-slate-800/50 text-slate-600 opacity-40 cursor-not-allowed'
                          : 'bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      ${p}
                    </button>
                  ))}
                </div>

                {/* Custom Amount input */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5 uppercase">
                    Or Enter Custom Cashout:
                  </label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min="20"
                      max={availableBalance}
                      step="1"
                      placeholder="e.g. 150"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-[var(--neon-cyan)] text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Recipient Account Details */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#0d102b] border border-slate-800 space-y-4">
                <h3 className="text-sm font-heading font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[var(--neon-cyan)] text-black flex items-center justify-center text-xs font-black">3</span>
                  Recipient Account Details
                </h3>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">
                    Your {method} Receiving Address / Tag / Handle *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={payoutMethods.find(m => m.name === method)?.placeholder || 'e.g. Cashtag or Wallet Address'}
                    value={recipientAccount}
                    onChange={(e) => setRecipientAccount(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-[var(--neon-cyan)]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Please double-check your address carefully. Payouts are irreversible once dispatched.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting || availableBalance < 20}
                  className="w-full py-4 rounded-2xl font-heading font-black text-base tracking-wider bg-gradient-to-r from-[var(--neon-cyan)] via-blue-500 to-indigo-600 text-black shadow-[0_0_25px_rgba(0,240,255,0.4)] hover:scale-101 active:scale-99 transition-all disabled:opacity-50 mt-4 cursor-pointer"
                >
                  {submitting
                    ? 'DISPATCHING REQUEST...'
                    : availableBalance < 20
                    ? 'MINIMUM CASHOUT IS $20.00'
                    : `REQUEST CASHOUT OF $${finalAmount.toFixed(2)}`}
                </button>
              </div>
            </form>

            {/* Right 5 Columns: Rules & Escrow Security Notice */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-5 sm:p-6 rounded-3xl bg-[#0d102b] border border-slate-800 space-y-4">
                <h3 className="text-sm font-heading font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  <span>Withdrawal Rules & Guarantees</span>
                </h3>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="font-bold text-white block mb-0.5">⏱ Fast Payout SLA</span>
                    <span className="text-[11px] text-slate-400">Cash App & Crypto payouts are dispatched within 5 to 15 minutes 24/7.</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="font-bold text-white block mb-0.5">💰 Zero Hidden Deductions</span>
                    <span className="text-[11px] text-slate-400">100% 1:1 USD payout guarantee with no surprise processing cuts.</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="font-bold text-white block mb-0.5">🛡 Account Security Escrow</span>
                    <span className="text-[11px] text-slate-400">Funds are held in secure escrow while in transit to prevent duplicate requests.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Previous Withdrawal History Table */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#0d102b] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-heading font-black text-white flex items-center gap-2">
                <Clock size={16} className="text-[var(--neon-cyan)]" />
                <span>Your Cashout History</span>
              </h3>
              <button
                type="button"
                onClick={fetchHistory}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <RefreshCw size={12} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingHistory ? (
              <div className="p-8 text-center text-slate-500 text-xs">Loading cashouts...</div>
            ) : withdrawHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No cashout requests recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                    <tr>
                      <th className="pb-3 px-3">Date</th>
                      <th className="pb-3 px-3">Method</th>
                      <th className="pb-3 px-3">Amount</th>
                      <th className="pb-3 px-3">Recipient Account</th>
                      <th className="pb-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {withdrawHistory.map((w) => (
                      <tr key={w.id || w._id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-3 text-slate-400">
                          {w.createdAt ? new Date(w.createdAt).toLocaleDateString() : 'Recent'}
                        </td>
                        <td className="py-3 px-3 text-white font-bold">{w.payoutMethod || w.method || 'Cash App'}</td>
                        <td className="py-3 px-3 text-[var(--neon-cyan)] font-black">
                          ${Number(w.amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-slate-300">{w.recipientDetails || w.destinationTag || '-'}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              w.status === 'APPROVED' || w.status === 'COMPLETED' || w.status === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : w.status === 'REJECTED'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {w.status || 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* Cyber Footer */}
        <CyberFooter />
      </div>

      {/* Daily Spin Wheel Modal */}
      <DailySpinWheelModal
        isOpen={spinWheelOpen}
        onClose={() => setSpinWheelOpen(false)}
        user={user}
        onBalanceUpdated={fetchUser}
      />

      {/* Mobile Bottom Nav */}
      <CyberMobileBottomNav
        user={user}
        onOpenAuth={(mode) => router.push(`/${mode}`)}
        onOpenWallet={(tab) => {
          if (tab === 'deposit') router.push('/deposit');
          else router.push('/withdraw');
        }}
        onOpenSpinWheel={() => setSpinWheelOpen(true)}
      />
    </div>
  );
}
