'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  CreditCard,
  QrCode,
  Zap,
  Tag,
  Clock
} from 'lucide-react';

export default function WalletModal({
  isOpen,
  onClose,
  initialTab = 'deposit',
  user,
  onBalanceUpdated,
}) {
  const [tab, setTab] = useState(initialTab);
  const [methods, setMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [depositAmount, setDepositAmount] = useState('50');
  const [referenceNote, setReferenceNote] = useState('');
  const [promoCode, setPromoCode] = useState('');

  // Cashout state
  const [cashoutAmount, setCashoutAmount] = useState('50');
  const [destinationTag, setDestinationTag] = useState('');
  const [cashoutMethod, setCashoutMethod] = useState('Cash App');

  const [loading, setLoading] = useState(false);
  const [copiedTag, setCopiedTag] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/payments/methods')
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.methods?.length > 0) {
            setMethods(data.methods);
            setSelectedMethod(data.methods[0]);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyTag = (tag) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(true);
    setTimeout(() => setCopiedTag(false), 2000);
  };

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });
    setLoading(true);

    try {
      const res = await fetch('/api/payments/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: depositAmount,
          method: selectedMethod?.name || 'Cash App',
          referenceNumber: referenceNote,
          promoCode,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit deposit.');
      }

      setStatusMsg({
        type: 'success',
        text: 'Deposit submitted successfully! Our financial team is verifying and crediting your account.',
      });
      setReferenceNote('');
      if (onBalanceUpdated) onBalanceUpdated();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCashoutSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: '', text: '' });
    setLoading(true);

    try {
      const res = await fetch('/api/payments/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: cashoutAmount,
          method: cashoutMethod,
          destinationTag,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit cashout.');
      }

      setStatusMsg({
        type: 'success',
        text: `Redemption of $${parseFloat(cashoutAmount).toFixed(2)} requested! Payout will be sent to ${destinationTag} within minutes.`,
      });
      setDestinationTag('');
      if (onBalanceUpdated) onBalanceUpdated();
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = ['20', '50', '100', '250', '500'];

  return (
    <div className="cyber-modal-overlay">
      <div className="relative w-full max-w-lg rounded-3xl border border-[var(--chrome-border)] bg-[var(--bg-deep)] p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Glow ambient */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--neon-cyan)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[var(--neon-purple)]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors z-20"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--neon-cyan)] to-blue-600 flex items-center justify-center text-black font-black shadow-[0_0_15px_rgba(0,240,255,0.4)]">
            <Wallet size={22} />
          </div>
          <div>
            <h2 className="font-heading font-black text-xl text-white">
              CASHIER & WALLET
            </h2>
            <p className="text-xs text-slate-400">
              Current Balance:{' '}
              <span className="font-mono font-bold text-emerald-400">
                ${Number(user?.balanceSC || 0).toFixed(2)} SC
              </span>
            </p>
          </div>
        </div>

        {/* Switcher */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-900 border border-slate-800 mb-5">
          <button
            type="button"
            onClick={() => {
              setTab('deposit');
              setStatusMsg({ type: '', text: '' });
            }}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs font-heading font-bold rounded-lg transition-all ${
              tab === 'deposit'
                ? 'bg-gradient-to-r from-[var(--neon-cyan)] to-blue-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft size={16} />
            <span>INSTANT DEPOSIT</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('withdraw');
              setStatusMsg({ type: '', text: '' });
            }}
            className={`flex items-center justify-center gap-2 py-2.5 text-xs font-heading font-bold rounded-lg transition-all ${
              tab === 'withdraw'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpRight size={16} />
            <span>REDEEM CASHOUT</span>
          </button>
        </div>

        {/* Status Alerts */}
        {statusMsg.text && (
          <div
            className={`mb-4 p-3 rounded-xl border flex items-center gap-2 text-xs ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                : 'bg-red-950/60 border-red-500/50 text-red-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-red-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* TAB 1: DEPOSIT */}
        {tab === 'deposit' && (
          <form onSubmit={handleDepositSubmit} className="space-y-4">
            {/* Method Chooser */}
            <div>
              <label className="block text-[11px] font-sub font-bold text-slate-300 mb-2">
                1. SELECT PAYMENT GATEWAY
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {methods.map((m) => {
                  const selected = selectedMethod?.methodId === m.methodId;
                  return (
                    <button
                      key={m.id || m.methodId}
                      type="button"
                      onClick={() => setSelectedMethod(m)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selected
                          ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/15 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-heading font-bold text-xs text-white">
                        {m.name}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {m.badge || `Min: $${m.minDeposit}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Method Details & Tag */}
            {selectedMethod && (
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-sub font-bold text-slate-400">
                    SEND PAYMENT TO:
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                    VERIFIED OFFICIAL DESK
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-mono font-bold text-sm text-[var(--neon-cyan)] select-all">
                    {selectedMethod.tag || '$PlayersParadiseHub'}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyTag(selectedMethod.tag || '$PlayersParadiseHub')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
                  >
                    {copiedTag ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedTag ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {selectedMethod.instructions}
                </p>
              </div>
            )}

            {/* Amount input & Quick Chips */}
            <div>
              <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1.5">
                2. ENTER AMOUNT (USD)
              </label>
              <div className="flex items-center gap-2 mb-2">
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(amt)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold font-mono transition-all ${
                      depositAmount === amt
                        ? 'bg-[var(--neon-cyan)] text-black shadow-md'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="10"
                  max="10000"
                  step="1"
                  required
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="cyber-input pl-8 font-mono font-bold text-base"
                />
                <span className="absolute left-3 top-3 text-slate-400 font-bold">$</span>
              </div>
            </div>

            {/* Reference note / Cashtag identifier */}
            <div>
              <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
                3. TRANSACTION NOTE OR CASHTAG (FOR FAST MATCH)
              </label>
              <input
                type="text"
                placeholder="e.g. Sent from $JohnDoe77 or Ref# 928374"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                className="cyber-input"
              />
            </div>

            {/* Promo Code */}
            <div>
              <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1">
                PROMO / BONUS CODE (OPTIONAL)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. PARADISE100"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="cyber-input uppercase pl-9"
                />
                <Tag size={15} className="absolute left-3 top-3.5 text-slate-500" />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full cyber-btn-cyan py-3 rounded-xl font-heading font-black text-sm tracking-wider"
            >
              {loading ? 'SUBMITTING TRANSACTION...' : 'I HAVE SENT PAYMENT • CONFIRM DEPOSIT'}
            </button>
          </form>
        )}

        {/* TAB 2: CASHOUT */}
        {tab === 'withdraw' && (
          <form onSubmit={handleCashoutSubmit} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-sub font-bold text-slate-400">
                  REDEEMABLE BALANCE
                </span>
                <div className="font-heading font-black text-lg text-emerald-400">
                  ${Number(user?.balanceSC || 0).toFixed(2)} SC
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400">MIN CASHOUT</span>
                <div className="font-mono font-bold text-xs text-white">$25.00 SC</div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1.5">
                PAYOUT GATEWAY
              </label>
              <select
                value={cashoutMethod}
                onChange={(e) => setCashoutMethod(e.target.value)}
                className="cyber-input bg-slate-900"
              >
                <option value="Cash App">Cash App Pay (Instant)</option>
                <option value="Chime">Chime Direct Deposit</option>
                <option value="Zelle">Zelle Instant Bank Transfer</option>
                <option value="Bitcoin">Bitcoin (BTC Crypto Wallet)</option>
                <option value="USDT">USDT Tether (TRC-20)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1.5">
                YOUR CASHTAG / WALLET ADDRESS
              </label>
              <input
                type="text"
                required
                placeholder={
                  cashoutMethod === 'Cash App'
                    ? 'e.g. $MyCashtag'
                    : cashoutMethod === 'Bitcoin'
                    ? '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'
                    : 'Your account handle / email'
                }
                value={destinationTag}
                onChange={(e) => setDestinationTag(e.target.value)}
                className="cyber-input"
              />
            </div>

            <div>
              <label className="block text-[11px] font-sub font-bold text-slate-300 mb-1.5">
                AMOUNT TO REDEEM (MIN $25)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="25"
                  max={user?.balanceSC || 10000}
                  step="1"
                  required
                  value={cashoutAmount}
                  onChange={(e) => setCashoutAmount(e.target.value)}
                  className="cyber-input pl-8 font-mono font-bold text-base"
                />
                <span className="absolute left-3 top-3 text-slate-400 font-bold">$</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (user?.balanceSC || 0) < 25}
              className="w-full py-3 rounded-xl font-heading font-black text-sm tracking-wider bg-gradient-to-r from-emerald-500 to-teal-500 text-black shadow-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'PROCESSING CASHOUT...' : 'CONFIRM INSTANT REDEMPTION'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
