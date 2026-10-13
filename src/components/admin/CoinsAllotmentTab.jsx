'use client';

import React, { useState } from 'react';
import {
  Coins,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  DollarSign
} from 'lucide-react';

export default function CoinsAllotmentTab({
  usersList = [],
  onExecuteAllotment,
}) {
  const [targetUser, setTargetUser] = useState('');
  const [selectedUserObj, setSelectedUserObj] = useState(null);
  const [actionType, setActionType] = useState('CREDIT'); // 'CREDIT' | 'DEBIT'
  const [amountSC, setAmountSC] = useState('');
  const [amountGC, setAmountGC] = useState('');
  const [notes, setNotes] = useState('Admin VIP Reward Allocation');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const presetsSC = ['10', '25', '50', '100', '250', '500'];
  const reasonPresets = [
    'VIP Loyalty Reward',
    'Manual Deposit Fix Credit',
    'Daily Mystery Bonus Adjustment',
    'Contest / Tournament Winner',
    'Administrative Balance Correction'
  ];

  const handleSelectUser = (u) => {
    setTargetUser(u.username);
    setSelectedUserObj(u);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetUser.trim()) {
      setFeedback({ type: 'error', text: 'Please specify target player username or email.' });
      return;
    }
    if (!amountSC && !amountGC) {
      setFeedback({ type: 'error', text: 'Please enter an amount for SC or GC.' });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: '', text: '' });
    try {
      await onExecuteAllotment({
        targetUser: targetUser.trim(),
        amountSC: amountSC || '0',
        amountGC: amountGC || '0',
        actionType,
        notes,
      });
      setFeedback({
        type: 'success',
        text: `Successfully ${actionType === 'CREDIT' ? 'credited' : 'debited'} ${targetUser}!`,
      });
      setAmountSC('');
      setAmountGC('');
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Allotment failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-[#090d22]/90 border border-cyan-500/20 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-[0_0_20px_rgba(0,240,255,0.25)]">
            <Coins size={28} />
          </div>
          <div>
            <h2 className="font-heading font-black text-lg md:text-xl text-white tracking-wide">
              COINS ALLOTMENT & BALANCE ADJUSTER
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Instantly credit or debit player balances (Sweepstakes Coins SC & Game Coins GC) with audit tracking.
            </p>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback.text && (
        <div
          className={`p-4 rounded-2xl border flex items-center gap-2.5 text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/60 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span className="font-medium">{feedback.text}</span>
        </div>
      )}

      {/* Form Card */}
      <form onSubmit={handleSubmit} className="p-6 rounded-3xl bg-[#090d22]/90 border border-cyan-500/20 backdrop-blur-xl space-y-6">
        {/* Step 1: Target Player */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            1. Select Target Player (Username or Email)
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={targetUser}
              onChange={(e) => {
                setTargetUser(e.target.value);
                const found = usersList.find(
                  (u) => u.username.toLowerCase() === e.target.value.toLowerCase()
                );
                setSelectedUserObj(found || null);
              }}
              placeholder="e.g. player_one or player@demo.com"
              className="w-full bg-slate-950/90 border border-slate-700 focus:border-cyan-400 text-white rounded-2xl px-4 py-3 text-sm outline-none"
            />
          </div>

          {/* Quick select chips from usersList */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-slate-500 font-bold">Suggestions:</span>
            {usersList.slice(0, 6).map((u) => (
              <button
                type="button"
                key={u.id || u._id}
                onClick={() => handleSelectUser(u)}
                className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  targetUser === u.username
                    ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                @{u.username} (${Number(u.balanceSC || 0).toFixed(0)} SC)
              </button>
            ))}
          </div>

          {selectedUserObj && (
            <div className="p-3 rounded-xl bg-slate-950/90 border border-cyan-500/30 flex items-center justify-between text-xs mt-2">
              <span className="text-slate-400">Current Balances:</span>
              <div className="flex items-center gap-3">
                <span className="text-cyan-400 font-bold">${Number(selectedUserObj.balanceSC || 0).toFixed(2)} SC</span>
                <span className="text-purple-400 font-bold">{Number(selectedUserObj.balanceGC || 0).toLocaleString()} GC</span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Action Type */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            2. Choose Transaction Direction
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActionType('CREDIT')}
              className={`py-3 px-4 rounded-2xl font-heading font-black text-xs md:text-sm border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                actionType === 'CREDIT'
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.35)]'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>+ CREDIT TO PLAYER (ADD)</span>
            </button>
            <button
              type="button"
              onClick={() => setActionType('DEBIT')}
              className={`py-3 px-4 rounded-2xl font-heading font-black text-xs md:text-sm border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                actionType === 'DEBIT'
                  ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.35)]'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>- DEBIT FROM PLAYER (DEDUCT)</span>
            </button>
          </div>
        </div>

        {/* Step 3: Amounts */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            3. Enter Currency Amounts
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] font-bold text-cyan-400 mb-1 flex items-center justify-between">
                <span>Sweepstakes Coins (SC - Redeemable $)</span>
              </div>
              <input
                type="number"
                step="0.01"
                value={amountSC}
                onChange={(e) => setAmountSC(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-cyan-400 text-white rounded-xl px-4 py-2.5 text-sm outline-none"
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {presetsSC.map((val) => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => setAmountSC(val)}
                    className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-400 cursor-pointer"
                  >
                    +${val}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold text-purple-400 mb-1">
                Game Coins (GC - Freeplay Entertainment)
              </div>
              <input
                type="number"
                step="1"
                value={amountGC}
                onChange={(e) => setAmountGC(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-950/90 border border-slate-700 focus:border-purple-400 text-white rounded-xl px-4 py-2.5 text-sm outline-none"
              />
            </div>
          </div>
        </div>

        {/* Step 4: Reason / Notes */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            4. Reason & Reference Notes
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {reasonPresets.map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setNotes(r)}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer"
              >
                {r}
              </button>
            ))}
          </div>
          <input
            type="text"
            required
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-950/90 border border-slate-700 focus:border-cyan-400 text-white rounded-xl px-4 py-2.5 text-xs outline-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-500 hover:from-cyan-400 hover:to-pink-400 text-slate-950 font-heading font-black text-sm tracking-wider flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(0,240,255,0.4)] transition-all cursor-pointer disabled:opacity-50"
        >
          {submitting ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              EXECUTING ADJUSTMENT...
            </>
          ) : (
            <>
              <Coins size={18} />
              EXECUTE {actionType} ADJUSTMENT NOW
            </>
          )}
        </button>
      </form>
    </div>
  );
}
