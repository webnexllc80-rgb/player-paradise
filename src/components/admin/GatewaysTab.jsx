'use client';

import React from 'react';
import {
  CreditCard,
  Plus,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  ExternalLink,
  DollarSign
} from 'lucide-react';

export default function GatewaysTab({
  methods = [],
  onOpenAddModal,
  onToggleGateway,
}) {
  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="p-4 rounded-2xl bg-[#090d22]/90 border border-cyan-500/20 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-black text-sm md:text-base text-white tracking-wider flex items-center gap-2">
            <CreditCard size={18} className="text-cyan-400" /> PAYMENT GATEWAY DIRECTORY
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure deposit channels, merchant cashtags, transfer notes, and transaction limits.
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-heading font-black text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(0,240,255,0.35)] transition-all cursor-pointer"
        >
          <Plus size={15} />
          <span>ADD NEW GATEWAY</span>
        </button>
      </div>

      {/* Gateways Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {methods.map((method) => {
          const isActive = method.active !== false;

          return (
            <div
              key={method.id || method._id}
              className={`p-5 rounded-2xl bg-[#090d22]/90 border transition-all flex flex-col justify-between space-y-4 ${
                isActive
                  ? 'border-slate-800 hover:border-cyan-500/50 shadow-sm'
                  : 'border-slate-800/50 opacity-60'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-white">{method.name}</h3>
                    <span className="text-[10px] text-purple-400 font-mono uppercase">{method.category || 'GATEWAY'}</span>
                  </div>
                </div>

                <button
                  onClick={() => onToggleGateway?.(method.id || method._id, !isActive)}
                  className={`p-1 text-xs transition-colors cursor-pointer ${
                    isActive ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                  title={isActive ? 'Deactivate' : 'Activate'}
                >
                  {isActive ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>

              {/* Details */}
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Merchant Handle / Tag:</div>
                  <div className="font-mono text-cyan-300 font-bold text-xs truncate">
                    {method.identifierTag || method.cashtag || 'Direct Merchant'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">MIN DEPOSIT</span>
                    <span className="font-bold text-white">${method.minDeposit || 10} SC</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                    <span className="text-slate-500 block text-[10px]">MAX DEPOSIT</span>
                    <span className="font-bold text-white">${method.maxDeposit || 5000} SC</span>
                  </div>
                </div>

                {method.instructions && (
                  <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
                    Note: {method.instructions}
                  </div>
                )}
              </div>

              {/* Status Footer */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-[11px]">
                <span className="text-slate-500">Status:</span>
                <span
                  className={`font-bold ${
                    isActive ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  {isActive ? 'ONLINE & ACCEPTING' : 'OFFLINE'}
                </span>
              </div>
            </div>
          );
        })}

        {methods.length === 0 && (
          <div className="col-span-full text-center py-12 p-6 rounded-2xl bg-[#090d22]/50 border border-slate-800 text-slate-500 space-y-2">
            <CreditCard size={28} className="mx-auto opacity-40 text-cyan-400" />
            <p className="font-heading text-sm">No payment gateways configured yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
