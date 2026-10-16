'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Upload,
  AlertCircle,
  Clock,
  Sparkles,
  QrCode,
  DollarSign,
  HelpCircle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import CyberNavbar from '@/components/navigation/CyberNavbar';
import CyberSidebar from '@/components/navigation/CyberSidebar';
import CyberMobileBottomNav from '@/components/navigation/CyberMobileBottomNav';
import CyberFooter from '@/components/common/CyberFooter';
import DailySpinWheelModal from '@/components/common/DailySpinWheelModal';

export default function DepositPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [spinWheelOpen, setSpinWheelOpen] = useState(false);

  // Deposit Form State
  const [gateways, setGateways] = useState([]);
  const [selectedGateway, setSelectedGateway] = useState(null);
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [senderAccount, setSenderAccount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [proofFileName, setProofFileName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // History State
  const [depositHistory, setDepositHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // 1. Fetch current user
  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        router.push('/login?redirect=/deposit');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUser(false);
    }
  };

  // 2. Fetch gateways
  const fetchGateways = async () => {
    try {
      const res = await fetch('/api/payments/methods');
      const data = await res.json();
      if (data.success && data.methods && data.methods.length > 0) {
        setGateways(data.methods);
        setSelectedGateway(data.methods[0]);
      } else {
        // Fallback default gateways
        const defaults = [
          { id: 'cashapp', name: 'Cash App', type: 'cashapp', address: '$PlayersParadiseCash', tag: '$PlayersParadiseCash', minDeposit: 10, instructions: 'Add note: "Entertainment Services"' },
          { id: 'crypto-btc', name: 'Bitcoin (BTC)', type: 'crypto', address: 'bc1qplayersparadisehubdeposit777address', minDeposit: 20, instructions: 'Send exact BTC equivalent' },
          { id: 'crypto-usdt', name: 'USDT (TRC20)', type: 'crypto', address: 'TXplayersparadiseusdttrc20safehub77', minDeposit: 20, instructions: 'Tron TRC20 network only' },
          { id: 'venmo', name: 'Venmo', type: 'venmo', address: '@PlayersParadisePay', minDeposit: 10, instructions: 'Do not mark as goods & services' },
          { id: 'paypal', name: 'PayPal Friends', type: 'paypal', address: 'pay@playersparadisehub.com', minDeposit: 20, instructions: 'Send as Friends & Family only' },
          { id: 'zelle', name: 'Zelle Pay', type: 'zelle', address: 'zelle@playersparadisehub.com', minDeposit: 25, instructions: 'Instant bank transfer' },
        ];
        setGateways(defaults);
        setSelectedGateway(defaults[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 3. Fetch deposit history
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/payments/deposit');
      const data = await res.json();
      if (data.success && data.deposits) {
        setDepositHistory(data.deposits);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchUser();
    fetchGateways();
    fetchHistory();
  }, []);

  const handleCopy = (text, fieldName) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    setProofFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setProofImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;

  const handleSubmitDeposit = async (e) => {
    e.preventDefault();
    if (!finalAmount || finalAmount < 5) {
      setStatusMessage({ type: 'error', text: 'Minimum deposit is $5.00' });
      return;
    }

    if (!senderAccount.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter your sending Cashtag, Wallet, or Name.' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const payload = {
        amount: finalAmount,
        method: selectedGateway?.name || 'Cash App',
        methodId: selectedGateway?.id || 'cashapp',
        senderAccount: senderAccount.trim(),
        transactionId: transactionId.trim(),
        proofImage,
      };

      const res = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: `Deposit request for $${finalAmount.toFixed(2)} submitted! Desk agents are verifying your payment.`,
        });
        setSenderAccount('');
        setTransactionId('');
        setProofImage('');
        setProofFileName('');
        fetchHistory();
        fetchUser();
      } else {
        setStatusMessage({ type: 'error', text: data.message || 'Deposit submission failed.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message || 'Network error occurred.' });
    } finally {
      setSubmitting(false);
    }
  };

  const presetAmounts = [20, 50, 100, 200, 500];

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
          if (tab === 'withdraw') router.push('/withdraw');
          else router.push('/deposit');
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
            if (tab === 'withdraw') router.push('/withdraw');
            else router.push('/deposit');
          }}
          onOpenSpinWheel={() => setSpinWheelOpen(true)}
        />

        {/* Center Content Body */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Header Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-[#0c102b] p-6 sm:p-8 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
                  <ArrowDownLeft size={14} />
                  <span>Instant Player Deposit Gateway</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-heading font-black text-white tracking-tight">
                  LOAD YOUR <span className="text-emerald-400">PLAYING BALANCE</span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                  Fund your account instantly with 0% fees. Direct crediting into your playable balance for Fire Kirin, Orion Stars, Juwa, Panda Master, and more.
                </p>
              </div>

              {/* Balance Widget Card */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/40 flex flex-col items-end min-w-[160px]">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">CURRENT BALANCE</span>
                <span className="font-mono font-black text-2xl sm:text-3xl text-emerald-400 mt-0.5">
                  ${Number(user?.balance || user?.balanceSC || 0).toFixed(2)}
                </span>
                <span className="text-[10px] text-emerald-300/80 flex items-center gap-1 mt-1">
                  <CheckCircle2 size={11} /> 100% Verified Escrow
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

          {/* Form & Gateway Split Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 7 Columns: Step 1 & 2 Inputs */}
            <div className="lg:col-span-7 space-y-6">
              {/* Step 1: Select Payment Method */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#0d102b] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-heading font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center text-xs font-black">1</span>
                    Select Payment Gateway
                  </h3>
                  <span className="text-xs text-slate-400">0% Transaction Fee</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {gateways.map((gw) => {
                    const isSelected = selectedGateway?.id === gw.id;
                    return (
                      <button
                        key={gw.id}
                        type="button"
                        onClick={() => setSelectedGateway(gw)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-950/50 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                            : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-heading font-bold text-white truncate">{gw.name}</span>
                          {isSelected && <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />}
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          Min ${gw.minDeposit || 10}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Choose Deposit Amount */}
              <div className="p-5 sm:p-6 rounded-3xl bg-[#0d102b] border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-heading font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center text-xs font-black">2</span>
                    Select Amount ($ USD)
                  </h3>
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles size={12} /> +100% First Load Match
                  </span>
                </div>

                {/* Amount presets */}
                <div className="grid grid-cols-5 gap-2">
                  {presetAmounts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setAmount(p);
                        setCustomAmount('');
                      }}
                      className={`py-3 rounded-xl font-heading font-bold text-sm transition-all ${
                        !customAmount && amount === p
                          ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
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
                    Or Enter Custom Amount:
                  </label>
                  <div className="relative">
                    <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min="5"
                      step="1"
                      placeholder="e.g. 75"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-emerald-400 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Player Sender Details & Receipt */}
              <form onSubmit={handleSubmitDeposit} className="p-5 sm:p-6 rounded-3xl bg-[#0d102b] border border-slate-800 space-y-4">
                <h3 className="text-sm font-heading font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center text-xs font-black">3</span>
                  Confirm Payment Details
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Your Sending Cashtag / Name / Wallet Address *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={selectedGateway?.type === 'cashapp' ? 'e.g. $JohnDoe77' : 'e.g. John Doe / Tx Address'}
                      value={senderAccount}
                      onChange={(e) => setSenderAccount(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Transaction ID / Web Confirmation Code (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. #981240192 or TxHash"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  {/* Upload Receipt / Screenshot */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      Upload Payment Receipt / Screenshot
                    </label>
                    <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-900/40 relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                        <Upload size={20} className="text-emerald-400" />
                        <span className="text-xs font-bold text-slate-200">
                          {proofFileName ? `Selected: ${proofFileName}` : 'Click or drop payment screenshot here'}
                        </span>
                        <span className="text-[10px] text-slate-500">PNG, JPG, or WEBP up to 5MB</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-2xl font-heading font-black text-base tracking-wider bg-gradient-to-r from-emerald-400 to-teal-500 text-black shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:scale-101 active:scale-99 transition-all disabled:opacity-50 mt-4 cursor-pointer"
                >
                  {submitting ? 'SUBMITTING REQUEST...' : `SUBMIT $${finalAmount.toFixed(2)} DEPOSIT REQUEST`}
                </button>
              </form>
            </div>

            {/* Right 5 Columns: Gateway Instructions & Live Escrow Box */}
            <div className="lg:col-span-5 space-y-6">
              {selectedGateway && (
                <div className="p-5 sm:p-6 rounded-3xl bg-[#0d102b] border border-emerald-500/30 shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-heading font-bold text-emerald-400 uppercase tracking-wider">
                      Gateway Credentials
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      LIVE DESK
                    </span>
                  </div>

                  {/* Target Pay Address / Tag */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase block mb-1.5">
                      Send Payment To ({selectedGateway.name}):
                    </span>
                    <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                      <span className="font-mono font-black text-sm text-white select-all break-all">
                        {selectedGateway.address || selectedGateway.tag}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedGateway.address || selectedGateway.tag, 'gwAddress')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition-colors"
                      >
                        {copiedField === 'gwAddress' ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedField === 'gwAddress' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Gateway Instructions */}
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                      <AlertCircle size={14} />
                      <span>Important Instructions:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      {selectedGateway.instructions || 'Please send exact amount. After sending, enter your sender username and upload screenshot below.'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Average verification speed: <strong>1 to 3 minutes</strong> 24/7.
                    </p>
                  </div>
                </div>
              )}

              {/* Safe Escrow Assurance */}
              <div className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase">Players Paradise Guarantee</h4>
                    <p className="text-[11px] text-slate-400">All deposits are 100% verified & credited</p>
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 space-y-1">
                  <div>✓ Instant direct wallet top-up</div>
                  <div>✓ Dedicated 24/7 VIP desk assistance</div>
                  <div>✓ No hidden withdrawal limits or rollover lockups</div>
                </div>
              </div>
            </div>
          </div>

          {/* Previous Deposit History Table */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#0d102b] border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-heading font-black text-white flex items-center gap-2">
                <Clock size={16} className="text-emerald-400" />
                <span>Your Deposit History</span>
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
              <div className="p-8 text-center text-slate-500 text-xs">Loading deposits...</div>
            ) : depositHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No deposit requests recorded yet. Make your first deposit above!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-bold text-slate-400 uppercase border-b border-slate-800">
                    <tr>
                      <th className="pb-3 px-3">Date</th>
                      <th className="pb-3 px-3">Method</th>
                      <th className="pb-3 px-3">Amount</th>
                      <th className="pb-3 px-3">Sender Account</th>
                      <th className="pb-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {depositHistory.map((d) => (
                      <tr key={d.id || d._id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-3 text-slate-400">
                          {d.createdAt ? new Date(d.createdAt).toLocaleDateString() : 'Recent'}
                        </td>
                        <td className="py-3 px-3 text-white font-bold">{d.method || 'Cash App'}</td>
                        <td className="py-3 px-3 text-emerald-400 font-black">
                          ${Number(d.amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-slate-300">{d.senderAccount || '-'}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              d.status === 'APPROVED' || d.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : d.status === 'REJECTED'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {d.status || 'PENDING'}
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
          if (tab === 'withdraw') router.push('/withdraw');
          else router.push('/deposit');
        }}
        onOpenSpinWheel={() => setSpinWheelOpen(true)}
      />
    </div>
  );
}
