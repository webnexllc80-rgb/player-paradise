'use client';

import React, { useState } from 'react';
import {
  Search,
  Check,
  X,
  Copy,
  CheckCheck,
  RefreshCw,
  Wallet,
  Clock,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export default function FinanceRedemptionsView({
  redemptions = [],
  onApprove,
  onReject,
  onRefresh,
  isRefreshing = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, item: null, reason: '' });
  const [processingId, setProcessingId] = useState(null);

  const handleCopy = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = redemptions.filter((r) => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.username?.toLowerCase().includes(q) ||
      r.destinationAddress?.toLowerCase().includes(q) ||
      r.payoutMethod?.toLowerCase().includes(q) ||
      r.amount?.toString().includes(q);
    return matchesStatus && matchesSearch;
  });

  const pendingCount = redemptions.filter((r) => r.status === 'pending').length;
  const approvedCount = redemptions.filter((r) => r.status === 'approved').length;
  const rejectedCount = redemptions.filter((r) => r.status === 'rejected').length;

  const handleConfirmReject = async () => {
    if (!rejectModal.item) return;
    const reason = rejectModal.reason.trim() || 'Redemption rejected. Coins refunded to balance.';
    await onReject(rejectModal.item.id, reason);
    setRejectModal({ open: false, item: null, reason: '' });
  };

  const handleExecuteApprove = async (item) => {
    setProcessingId(item.id);
    try {
      await onApprove(item.id);
    } finally {
      setProcessingId(null);
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4" style={{ fontFamily: 'Lexend, -apple-system, sans-serif' }}>
      {/* Search & Filter Bar */}
      <div className="bg-[#0E0A24] border border-[#00F0FF]/25 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md shadow-xl">
        <div className="flex items-center gap-1.5 p-1 bg-[#140E33] rounded-xl border border-white/10 w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              statusFilter === 'all' ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30' : 'text-gray-400 hover:text-white'
            }`}
          >
            All ({redemptions.length})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-purple-400 hover:bg-purple-500/10'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              statusFilter === 'approved'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
                : 'text-emerald-400 hover:bg-emerald-500/10'
            }`}
          >
            Dispatched ({approvedCount})
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              statusFilter === 'rejected'
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                : 'text-red-400 hover:bg-red-500/10'
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2.5 px-3 py-2 bg-[#140E33] border border-[#00F0FF]/30 rounded-xl w-full md:w-64 focus-within:border-[#00F0FF] transition">
            <Search size={14} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search player, address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none p-0 border-none"
              style={{ fontFamily: 'Lexend, sans-serif' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-white shrink-0"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-[#00F0FF]/30 hover:border-[#00F0FF] text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer"
            style={{ fontFamily: 'Lexend, sans-serif' }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#00F0FF]' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-[#0E0A24] border border-[#00F0FF]/25 rounded-2xl shadow-xl">
          <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-gray-400">
            <Wallet size={26} />
          </div>
          <h4 className="text-sm font-bold text-white">No redemption requests found</h4>
          <p className="text-xs text-[#9A91A8] mt-1">Pending cashouts will appear here instantly with sound alert.</p>
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <div className="hidden lg:block bg-[#0E0A24] border border-[#00F0FF]/20 rounded-2xl overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs border-collapse" style={{ fontFamily: 'Lexend, sans-serif' }}>
              <thead className="bg-[#070514] text-[#9A91A8] uppercase font-black text-[11px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="p-4">Time &amp; Date</th>
                  <th className="p-4">Player</th>
                  <th className="p-4">Redeem Amount</th>
                  <th className="p-4">Payout Method</th>
                  <th className="p-4">Destination Address</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((r) => {
                  const isPending = r.status === 'pending';
                  return (
                    <tr
                      key={r.id}
                      className={`transition-colors ${
                        isPending ? 'bg-purple-500/[0.04] hover:bg-purple-500/[0.08]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <Clock size={12} className="text-gray-400" />
                            {formatRelativeTime(r.createdAt)}
                          </span>
                          <span className="text-[10.5px] text-gray-400 mt-0.5">
                            {new Date(r.createdAt).toLocaleString([], {
                              month: 'numeric',
                              day: 'numeric',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center font-black text-white text-xs uppercase shadow">
                            {r.username ? r.username.charAt(0) : 'U'}
                          </div>
                          <div>
                            <p className="font-black text-white text-sm">{r.username}</p>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                              ID: {r.userId?.slice(-6) || r.id?.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 font-black text-sm">
                          <span>${Number(r.amount).toFixed(2)}</span>
                          <span className="text-[10.5px] uppercase font-bold text-purple-400">SC</span>
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-white/10 border border-white/15 text-gray-300">
                          {r.payoutMethod || 'Direct'}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-amber-300 bg-black/40 border border-white/10 px-2 py-1 rounded-lg text-xs max-w-[180px] truncate select-all">
                            {r.destinationAddress}
                          </span>
                          <button
                            onClick={() => handleCopy(r.destinationAddress, r.id)}
                            className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white transition"
                          >
                            {copiedId === r.id ? (
                              <CheckCheck size={13} className="text-emerald-400" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        {isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                            PENDING
                          </span>
                        ) : r.status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <Check size={12} strokeWidth={3} />
                            DISPATCHED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-black uppercase bg-red-500/15 text-red-400 border border-red-500/30">
                            <X size={12} strokeWidth={3} />
                            REJECTED
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-right whitespace-nowrap">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleExecuteApprove(r)}
                              disabled={processingId === r.id}
                              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs flex items-center gap-1.5 transition shadow-lg shadow-purple-600/30 active:scale-95 disabled:opacity-50"
                            >
                              {processingId === r.id ? (
                                <RefreshCw size={13} className="animate-spin" />
                              ) : (
                                <Check size={14} strokeWidth={3} />
                              )}
                              <span>Mark Dispatched</span>
                            </button>

                            <button
                              onClick={() => setRejectModal({ open: true, item: r, reason: '' })}
                              className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-black text-xs flex items-center gap-1 transition active:scale-95"
                            >
                              <X size={13} strokeWidth={3} />
                              <span>Reject &amp; Refund</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-500 font-bold uppercase">Processed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE & TABLET CARDS */}
          <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filtered.map((r) => {
              const isPending = r.status === 'pending';
              return (
                <div
                  key={r.id}
                  className={`p-4 rounded-2xl border flex flex-col gap-3.5 transition shadow-xl ${
                    isPending
                      ? 'bg-[#0E0A24] border-purple-500/40 shadow-purple-500/10'
                      : 'bg-[#0E0A24] border-[#00F0FF]/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#00F0FF] to-[#E026D8] flex items-center justify-center font-black text-black text-sm shadow">
                        {r.username ? r.username.charAt(0) : 'U'}
                      </div>
                      <div>
                        <h4 className="font-black text-white text-sm leading-tight">{r.username}</h4>
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-0.5">
                          <Clock size={11} />
                          <span>{formatRelativeTime(r.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {isPending ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        PENDING
                      </span>
                    ) : r.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <Check size={11} />
                        DISPATCHED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/15 text-red-400 border border-red-500/30">
                        <X size={11} />
                        REJECTED
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-[#140E33] rounded-xl border border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-bold">Redeem Amount:</span>
                      <span className="font-black text-purple-300 text-sm font-mono">
                        ${Number(r.amount).toFixed(2)} SC
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-bold">Payout Method:</span>
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-white">
                        {r.payoutMethod || 'Direct'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[11px] text-gray-400 font-bold">Address:</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-amber-300 text-xs select-all truncate max-w-[160px]">
                          {r.destinationAddress}
                        </span>
                        <button
                          onClick={() => handleCopy(r.destinationAddress, r.id)}
                          className="p-1 rounded bg-white/10 text-gray-300 hover:text-white"
                        >
                          {copiedId === r.id ? (
                            <CheckCheck size={12} className="text-emerald-400" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isPending && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleExecuteApprove(r)}
                        disabled={processingId === r.id}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/25 active:scale-95 disabled:opacity-50"
                      >
                        {processingId === r.id ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Check size={14} strokeWidth={3} />
                        )}
                        <span>Mark Dispatched</span>
                      </button>

                      <button
                        onClick={() => setRejectModal({ open: true, item: r, reason: '' })}
                        className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-black text-xs flex items-center justify-center gap-1 active:scale-95"
                      >
                        <X size={13} strokeWidth={3} />
                        <span>Reject &amp; Refund</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Reject Reason Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#0d1021] border border-red-500/30 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle size={20} />
                <h3 className="text-base font-black text-white">Reject &amp; Refund Cashout</h3>
              </div>
              <button
                onClick={() => setRejectModal({ open: false, item: null, reason: '' })}
                className="text-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Rejecting cashout of{' '}
              <strong className="text-purple-300">${rejectModal.item?.amount} SC</strong> for{' '}
              <strong className="text-white">{rejectModal.item?.username}</strong>. Coins will be refunded
              to player balance.
            </p>

            <textarea
              rows={3}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="Enter reason for rejection (e.g. Invalid Cashtag or KYC required)..."
              className="w-full p-3 rounded-xl bg-black/50 border border-white/15 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-400"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModal({ open: false, item: null, reason: '' })}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white text-xs font-black shadow-lg shadow-red-500/30"
              >
                Refund Coins &amp; Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
