'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  Zap,
  Clock,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import CyberNavbar from '@/components/navigation/CyberNavbar';
import CyberSidebar from '@/components/navigation/CyberSidebar';
import CyberMobileBottomNav from '@/components/navigation/CyberMobileBottomNav';
import CyberFooter from '@/components/common/CyberFooter';

export default function LedgerPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const meRes = await fetch('/api/auth/me');
      const meData = await meRes.json();
      if (meData.authenticated && meData.user) {
        setUser(meData.user);
        const ledRes = await fetch('/api/ledger');
        const ledData = await ledRes.json();
        if (ledData.success) {
          setRecords(ledData.records || []);
        }
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-white flex flex-col">
      <CyberSidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        user={user}
        onOpenWallet={() => router.push('/wallet')}
        onOpenGameRequest={() => router.push('/')}
        onOpenChat={() => {}}
        onOpenDailyBonus={() => {}}
      />

      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <CyberNavbar
          onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          user={user}
          onOpenAuth={() => router.push('/')}
          onOpenWallet={() => router.push('/wallet')}
          onOpenDailyBonus={() => {}}
          onOpenNotifications={() => {}}
          onLogout={() => {
            fetch('/api/auth/logout', { method: 'POST' });
            setUser(null);
          }}
        />

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--neon-cyan)]/20 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/40 flex items-center justify-center font-bold">
                <Receipt size={20} />
              </div>
              <div>
                <h1 className="font-heading font-black text-xl md:text-2xl text-white">
                  TRANSACTION LEDGER
                </h1>
                <p className="text-xs text-slate-400">
                  Full immutable history of all your deposits, cashouts, daily bonuses, and game credits
                </p>
              </div>
            </div>

            <button
              onClick={loadData}
              className="p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-center text-slate-500 py-12">SYNCHRONIZING LEDGER ENTRIES...</p>
          ) : !user ? (
            <p className="text-xs text-center text-slate-400 py-12">Please log in to inspect your ledger records.</p>
          ) : records.length === 0 ? (
            <p className="text-xs text-center text-slate-400 py-12">No transactions recorded yet in your ledger.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 font-sub font-bold text-slate-400">
                  <tr>
                    <th className="p-3">DATE / TIME</th>
                    <th className="p-3">TRANSACTION TYPE</th>
                    <th className="p-3">SC AMOUNT</th>
                    <th className="p-3">GC AMOUNT</th>
                    <th className="p-3">STATUS</th>
                    <th className="p-3">NOTES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-bold font-sans text-white">
                        {r.type}
                      </td>
                      <td
                        className={`p-3 font-bold ${
                          r.amountSC >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.amountSC >= 0 ? `+` : ``}${Number(r.amountSC).toFixed(2)} SC
                      </td>
                      <td className="p-3 text-purple-300">
                        {r.amountGC ? `+${Number(r.amountGC).toLocaleString()} GC` : '—'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-sans font-bold">
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-sans text-[11px]">
                        {r.notes || 'Standard transaction'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>

        <CyberFooter />
      </div>

      <CyberMobileBottomNav user={user} onOpenAuth={() => {}} onOpenWallet={() => router.push('/wallet')} onOpenGameRequest={() => router.push('/')} />
    </div>
  );
}
