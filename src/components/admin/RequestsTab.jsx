'use client';

import React, { useState } from 'react';
import {
  KeyRound,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Sparkles,
  Gamepad2,
  Clock,
  User,
  ShieldAlert
} from 'lucide-react';

export default function RequestsTab({
  requests = [],
  onApproveClick,
  onRejectClick,
}) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const platforms = ['ALL', 'Ultra Panda', 'Fire Kirin', 'Orion Stars', 'Game Vault', 'Milky Way', 'Juwa'];

  const filteredRequests = requests.filter((req) => {
    // Status filter
    if (statusFilter === 'PENDING' && req.status !== 'PENDING') return false;
    if (statusFilter === 'APPROVED' && req.status !== 'READY' && req.status !== 'APPROVED') return false;
    if (statusFilter === 'REJECTED' && req.status !== 'REJECTED') return false;

    // Platform filter
    if (platformFilter !== 'ALL') {
      const p = (req.gameTitle || req.gamePlatform || '').toLowerCase();
      if (!p.includes(platformFilter.toLowerCase())) return false;
    }

    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchUsername = (req.playerUsername || '').toLowerCase().includes(q);
      const matchEmail = (req.playerEmail || '').toLowerCase().includes(q);
      const matchPlatform = (req.gameTitle || req.gamePlatform || '').toLowerCase().includes(q);
      if (!matchUsername && !matchEmail && !matchPlatform) return false;
    }

    return true;
  });

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'READY' || r.status === 'APPROVED').length;
  const rejectedCount = requests.filter((r) => r.status === 'REJECTED').length;

  return (
    <div className="space-y-5">
      {/* Top Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#090d22]/90 border border-cyan-500/20 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-cyan-500 text-slate-950 font-black shadow-[0_0_12px_rgba(0,240,255,0.4)]'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            ALL ({requests.length})
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500 text-slate-950 font-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <span>PENDING</span>
            {pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950 text-amber-300 font-mono">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-500 text-slate-950 font-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            APPROVED ({approvedCount})
          </button>
          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-500 text-white font-black shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            REJECTED ({rejectedCount})
          </button>
        </div>

        {/* Search & Platform Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search player, email..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none"
            />
          </div>

          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 focus:border-cyan-400 text-slate-300 rounded-xl px-3 py-1.5 text-xs outline-none"
          >
            {platforms.map((p) => (
              <option key={p} value={p}>
                {p === 'ALL' ? 'All Platforms' : p}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {filteredRequests.map((req) => {
          const isPending = req.status === 'PENDING';
          const isApproved = req.status === 'READY' || req.status === 'APPROVED';
          const isRejected = req.status === 'REJECTED';

          return (
            <div
              key={req.id || req._id}
              className="p-4 rounded-2xl bg-[#090d22]/90 border border-slate-800 hover:border-cyan-500/40 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
            >
              {/* Left Details */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Gamepad2 size={22} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-bold text-sm text-white">
                      @{req.playerUsername || 'Player'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {req.playerEmail}
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
                      {req.status}
                    </span>
                  </div>
                  <div className="text-xs text-cyan-400 font-mono mt-0.5 flex items-center gap-2">
                    <strong className="text-white">{req.gameTitle || req.gamePlatform}</strong>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Clock size={11} /> {new Date(req.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle: Credentials Display if Approved */}
              {isApproved && (req.gameAccountUsername || req.username) && (
                <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-xs flex items-center gap-3 font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block">USER:</span>
                    <span className="text-cyan-300 font-bold">{req.gameAccountUsername || req.username}</span>
                  </div>
                  <div className="border-l border-slate-800 pl-3">
                    <span className="text-slate-500 text-[10px] block">PASS:</span>
                    <span className="text-purple-300 font-bold">{req.gameAccountPassword || req.password}</span>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(
                        `${req.gameAccountUsername || req.username} | ${req.gameAccountPassword || req.password}`,
                        req.id || req._id
                      )
                    }
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white ml-1 cursor-pointer"
                    title="Copy Credentials"
                  >
                    {copiedId === (req.id || req._id) ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  </button>
                </div>
              )}

              {/* If Rejected: Show reason */}
              {isRejected && (
                <div className="text-xs text-rose-300 bg-rose-950/30 border border-rose-500/20 px-3 py-1.5 rounded-xl">
                  Reason: {req.rejectionReason || 'No reason specified'}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {isPending && (
                  <>
                    <button
                      onClick={() => onRejectClick(req)}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900/80 text-rose-200 text-xs font-bold transition-all cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onApproveClick(req)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-heading font-black shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={13} />
                      <span>APPROVE</span>
                    </button>
                  </>
                )}

                {isApproved && (
                  <button
                    onClick={() => onApproveClick(req)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Edit Creds
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredRequests.length === 0 && (
          <div className="text-center py-12 p-6 rounded-2xl bg-[#090d22]/50 border border-slate-800 text-slate-500 space-y-2">
            <KeyRound size={28} className="mx-auto opacity-40 text-cyan-400" />
            <p className="font-heading text-sm">No game requests matching the criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
