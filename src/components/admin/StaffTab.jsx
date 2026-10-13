'use client';

import React from 'react';
import {
  ShieldCheck,
  UserPlus,
  ShieldAlert,
  KeyRound,
  User,
  Clock,
  CheckCircle2
} from 'lucide-react';

export default function StaffTab({
  staffList = [],
  onOpenAddStaffModal,
}) {
  const roleDisplay = {
    super_admin: { label: 'Super Admin', color: 'bg-rose-950 border-rose-500/50 text-rose-300' },
    operation_admin: { label: 'Operational Manager', color: 'bg-cyan-950 border-cyan-500/50 text-cyan-300' },
    financial_manager: { label: 'Financial Manager', color: 'bg-emerald-950 border-emerald-500/50 text-emerald-300' },
    coin_manager: { label: 'Coins Manager', color: 'bg-amber-950 border-amber-500/50 text-amber-300' },
    chat_support: { label: 'Live Chat Agent', color: 'bg-purple-950 border-purple-500/50 text-purple-300' },
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="p-4 rounded-2xl bg-[#090d22]/90 border border-purple-500/20 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-black text-sm md:text-base text-white tracking-wider flex items-center gap-2">
            <ShieldCheck size={18} className="text-purple-400" /> STAFF & SUB-ADMIN MANAGEMENT
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Provision authorized administrators, operational managers, finance officers, and live support staff.
          </p>
        </div>

        <button
          onClick={onOpenAddStaffModal}
          className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-heading font-black text-xs flex items-center gap-1.5 shadow-[0_0_20px_rgba(192,38,211,0.4)] transition-all cursor-pointer"
        >
          <UserPlus size={15} />
          <span>ADD STAFF MEMBER</span>
        </button>
      </div>

      {/* Staff Directory */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffList.map((member) => {
          const roleConfig = roleDisplay[member.role] || {
            label: member.role?.replace('_', ' ') || 'Staff',
            color: 'bg-slate-900 border-slate-700 text-slate-300',
          };

          return (
            <div
              key={member.id || member._id}
              className="p-5 rounded-2xl bg-[#090d22]/90 border border-slate-800 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold text-sm text-white truncate">
                    @{member.username}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono truncate">
                    {member.email}
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Clearance Level:</span>
                  <span className={`inline-block px-3 py-1 rounded-xl text-xs font-bold border ${roleConfig.color}`}>
                    {roleConfig.label}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                  <Clock size={12} />
                  <span>Provisioned: {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'System Genesis'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
