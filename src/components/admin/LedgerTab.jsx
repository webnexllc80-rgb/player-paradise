'use client';

import React, { useState } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  CreditCard,
  AlertCircle,
  DollarSign
} from 'lucide-react';

export default function LedgerTab({
  deposits = [],
  withdrawals = [],
  onApproveDeposit,
  onRejectDeposit,
  onApproveWithdrawal,
  onRejectWithdrawal,
  onInspectProof,
}) {
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'DEPOSITS' | 'WITHDRAWALS'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  const [searchTerm, setSearchTerm] = useState('');

  // Combine deposits and withdrawals into unified ledger items
  const allTransactions = [
    ...deposits.map((d) => ({
      ...d,
      txType: 'DEPOSIT',
      amount: Number(d.amountSC || d.amount || 0),
    })),
    ...withdrawals.map((w) => ({
      ...w,
      txType: 'WITHDRAWAL',
      amount: Number(w.amountSC || w.amount || 0),
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const filteredTransactions = allTransactions.filter((tx) => {
    // Type Filter
    if (typeFilter === 'DEPOSITS' && tx.txType !== 'DEPOSIT') return false;
    if (typeFilter === 'WITHDRAWALS' && tx.txType !== 'WITHDRAWAL') return false;

    // Status Filter
    if (statusFilter === 'PENDING' && tx.status !== 'PENDING') return false;
    if (statusFilter === 'APPROVED' && tx.status !== 'APPROVED') return false;
    if (statusFilter === 'REJECTED' && tx.status !== 'REJECTED') return false;

    // Search Filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchPlayer = (tx.username || tx.playerUsername || '').toLowerCase().includes(q);
      const matchMethod = (tx.methodName || tx.method || '').toLowerCase().includes(q);
      const matchTag = (tx.senderTag || tx.cashtag || tx.payoutAddress || '').toLowerCase().includes(q);
      const matchId = (tx.id || tx._id || '').toLowerCase().includes(q);
      if (!matchPlayer && !matchMethod && !matchTag && !matchId) return false;
    }

    return true;
  });

  const pendingDepositsCount = deposits.filter((d) => d.status === 'PENDING').length;
  const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'PENDING').length;
  const totalPendingVolume = allTransactions
    .filter((tx) => tx.status === 'PENDING')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="space-y-5">
      {/* KPI Mini-Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-[#090d22]/90 border border-cyan-500/20 backdrop-blur-xl">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Deposits</div>
          <div className="text-xl font-heading font-black text-emerald-400 mt-1">
            {pendingDepositsCount} Transactions
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#090d22]/90 border border-purple-500/20 backdrop-blur-xl">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending Redemptions</div>
          <div className="text-xl font-heading font-black text-purple-400 mt-1">
            {pendingWithdrawalsCount} Requests
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#090d22]/90 border border-amber-500/20 backdrop-blur-xl">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Volume In Queue</div>
          <div className="text-xl font-heading font-black text-amber-400 mt-1">
            ${totalPendingVolume.toFixed(2)} SC
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#090d22]/90 border border-cyan-500/20 backdrop-blur-xl space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Type Selector */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'ALL'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              ALL TRANSACTIONS ({allTransactions.length})
            </button>
            <button
              onClick={() => setTypeFilter('DEPOSITS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                typeFilter === 'DEPOSITS'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <ArrowDownLeft size={13} />
              <span>DEPOSITS ({deposits.length})</span>
            </button>
            <button
              onClick={() => setTypeFilter('WITHDRAWALS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                typeFilter === 'WITHDRAWALS'
                  ? 'bg-purple-500 text-white font-black shadow-[0_0_12px_rgba(192,38,211,0.4)]'
                  : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <ArrowUpRight size={13} />
              <span>REDEMPTIONS ({withdrawals.length})</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search player, tag, ID..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
            />
          </div>
        </div>

        {/* Secondary Status Tabs */}
        <div className="flex items-center gap-1.5 border-t border-slate-800/80 pt-2.5">
          <span className="text-[11px] font-bold text-slate-400 mr-2 uppercase tracking-wider">Status:</span>
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-slate-800 text-white border border-cyan-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Records List */}
      <div className="space-y-3">
        {filteredTransactions.map((tx) => {
          const isDeposit = tx.txType === 'DEPOSIT';
          const isPending = tx.status === 'PENDING';
          const isApproved = tx.status === 'APPROVED';
          const isRejected = tx.status === 'REJECTED';
          const hasProof = !!(tx.proofImage || tx.proofUrl);

          return (
            <div
              key={tx.id || tx._id}
              className="p-4 rounded-2xl bg-[#090d22]/90 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              {/* Left Details */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                    isDeposit
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-purple-500/10 border-purple-500/40 text-purple-400'
                  }`}
                >
                  {isDeposit ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-bold text-sm text-white">
                      @{tx.username || tx.playerUsername || 'Player'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                        isDeposit ? 'bg-emerald-950 text-emerald-300' : 'bg-purple-950 text-purple-300'
                      }`}
                    >
                      {tx.txType}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                        isPending
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-600/40 animate-pulse'
                          : isApproved
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/40'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-600/40'
                      }`}
                    >
                      {tx.status}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold">{tx.methodName || tx.method}</span>
                    <span>•</span>
                    <span className="text-purple-300">
                      {isDeposit ? `Tag: ${tx.senderTag || 'N/A'}` : `To: ${tx.payoutAddress || tx.cashtag || 'N/A'}`}
                    </span>
                    <span>•</span>
                    <span className="text-slate-500 text-[11px] flex items-center gap-1">
                      <Clock size={11} /> {new Date(tx.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle: Amount & Proof Button */}
              <div className="flex items-center gap-4 self-end md:self-center">
                <div className="text-right">
                  <div
                    className={`font-heading font-black text-base ${
                      isDeposit ? 'text-emerald-400' : 'text-purple-400'
                    }`}
                  >
                    {isDeposit ? '+' : '-'}${tx.amount.toFixed(2)} <span className="text-xs font-sans text-slate-400">SC</span>
                  </div>
                  {tx.amountGC > 0 && (
                    <div className="text-[10px] text-amber-400 font-mono">
                      +{Number(tx.amountGC).toLocaleString()} GC
                    </div>
                  )}
                </div>

                {hasProof && (
                  <button
                    onClick={() => onInspectProof(tx)}
                    className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
                    title="Inspect Screenshot Proof"
                  >
                    <Eye size={14} />
                    <span>PROOF</span>
                  </button>
                )}
              </div>

              {/* Action Buttons for Pending Items */}
              {isPending && (
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() =>
                      isDeposit
                        ? onRejectDeposit(tx.id || tx._id)
                        : onRejectWithdrawal(tx.id || tx._id)
                    }
                    className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900/80 text-rose-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    Reject
                  </button>

                  <button
                    onClick={() =>
                      isDeposit
                        ? onApproveDeposit(tx.id || tx._id)
                        : onApproveWithdrawal(tx.id || tx._id)
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-heading font-black shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={13} />
                    <span>APPROVE</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredTransactions.length === 0 && (
          <div className="text-center py-12 p-6 rounded-2xl bg-[#090d22]/50 border border-slate-800 text-slate-500 space-y-2">
            <Wallet size={28} className="mx-auto opacity-40 text-emerald-400" />
            <p className="font-heading text-sm">No transaction ledger records matching criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
