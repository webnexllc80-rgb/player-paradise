'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { X, Sparkles, Gift, Clock, Award, CheckCircle2, AlertCircle } from 'lucide-react';
import { WHEEL_SLICES } from '@/lib/wheelConstants';

export default function DailySpinWheelModal({ isOpen, onClose, user, onBalanceUpdated }) {
  const [canSpin, setCanSpin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotationDegree, setRotationDegree] = useState(0);
  const [winResult, setWinResult] = useState(null);
  const [countdownText, setCountdownText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [nextSpinDate, setNextSpinDate] = useState(null);

  // Check eligibility on mount or when opened
  useEffect(() => {
    if (!isOpen) return;
    setWinResult(null);
    setErrorMessage('');

    async function checkStatus() {
      try {
        const res = await fetch('/api/daily-spin');
        const d = await res.json();
        if (d.success) {
          setCanSpin(d.canSpin);
          if (d.nextSpinAvailableAt) {
            setNextSpinDate(new Date(d.nextSpinAvailableAt));
          }
        }
      } catch (e) {
        console.error('Failed to check daily spin:', e);
      }
    }

    checkStatus();
  }, [isOpen]);

  // Live countdown timer if on cooldown
  useEffect(() => {
    if (!nextSpinDate) return;

    function updateTimer() {
      const now = new Date().getTime();
      const target = nextSpinDate.getTime();
      const diff = target - now;

      if (diff <= 0) {
        setCanSpin(true);
        setNextSpinDate(null);
        setCountdownText('');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdownText(`${hours}h ${mins}m ${secs}s`);
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [nextSpinDate]);

  if (!isOpen) return null;

  const slices = WHEEL_SLICES || [
    { label: '$1', value: 1, color: '#3B82F6' },
    { label: '$2', value: 2, color: '#10B981' },
    { label: '$3', value: 3, color: '#8B5CF6' },
    { label: '$5', value: 5, color: '#F59E0B' },
    { label: '$10', value: 10, color: '#EC4899' },
    { label: '$15', value: 15, color: '#06B6D4' },
    { label: '$25', value: 25, color: '#F97316' },
    { label: '$50', value: 50, color: '#E11D48' },
  ];

  const sliceAngle = 360 / slices.length;

  const handleSpin = async () => {
    if (!canSpin || spinning || loading) return;
    setLoading(true);
    setErrorMessage('');
    setWinResult(null);

    try {
      const res = await fetch('/api/daily-spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Spin failed.');
        setLoading(false);
        if (data.alreadySpun && data.nextSpinAvailableAt) {
          setCanSpin(false);
          setNextSpinDate(new Date(data.nextSpinAvailableAt));
        }
        return;
      }

      setSpinning(true);
      setLoading(false);

      // Target slice index (0 to 7)
      const targetIndex = data.sliceIndex;
      // Calculate target angle so pointer at 0 deg (top) aligns with target slice
      // Slices start from top, rotated clockwise.
      // Top pointer hits slice at (360 - (targetIndex * sliceAngle + sliceAngle / 2))
      const targetSliceCenter = targetIndex * sliceAngle + sliceAngle / 2;
      const baseRevolutions = 5 * 360; // 5 full rotations for drama
      const finalDegree = rotationDegree + baseRevolutions + (360 - (targetSliceCenter % 360));

      setRotationDegree(finalDegree);

      // Wait for spin animation (4.5s)
      setTimeout(() => {
        setSpinning(false);
        setCanSpin(false);
        setWinResult(data.winAmount);
        if (onBalanceUpdated) onBalanceUpdated();

        // Fire celebration confetti
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00F0FF', '#10B981', '#F59E0B', '#EC4899'],
        });

        // Set cooldown to 24h
        setNextSpinDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
      }, 4500);
    } catch (err) {
      setLoading(false);
      setSpinning(false);
      setErrorMessage(err.message || 'Network error occurred.');
    }
  };

  return (
    <div className="cyber-modal-overlay">
      <div className="relative w-full max-w-lg rounded-3xl border-2 border-[var(--neon-cyan)] bg-[#070919] p-5 sm:p-7 shadow-[0_0_50px_rgba(0,240,255,0.35)] max-h-[94vh] overflow-y-auto modal-scrollable">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors z-30"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="text-center space-y-1 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-sub text-xs font-bold">
            <Sparkles size={13} className="text-amber-400" />
            <span>DAILY FREE REWARD • WIN UP TO $50</span>
          </div>
          <h2 className="font-heading font-black text-2xl sm:text-3xl text-white">
            LUCKY <span className="text-[var(--neon-cyan)]">SPIN WHEEL</span>
          </h2>
          <p className="text-xs text-slate-400">
            Every verified player gets 1 Free Spin every 24 hours. Instant wallet credit!
          </p>
        </div>

        {/* Wheel Container */}
        <div className="relative flex flex-col items-center justify-center py-4">
          {/* Outer Ring Glow */}
          <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
            {/* Top Indicator Pointer */}
            <div className="absolute -top-3 z-20 flex flex-col items-center pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
              <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[26px] border-t-amber-400" />
              <div className="w-3 h-3 rounded-full bg-amber-300 -mt-7 shadow-sm" />
            </div>

            {/* Rotating SVG Wheel */}
            <div
              className="w-full h-full rounded-full border-4 border-amber-400/80 shadow-[0_0_30px_rgba(245,158,11,0.4)] overflow-hidden"
              style={{
                transform: `rotate(${rotationDegree}deg)`,
                transition: spinning ? 'transform 4.5s cubic-bezier(0.15, 0.95, 0.35, 1)' : 'none',
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full">
                {slices.map((slice, index) => {
                  const angle = sliceAngle;
                  const startAngle = index * angle;
                  const endAngle = startAngle + angle;

                  const startRad = (startAngle - 90) * (Math.PI / 180);
                  const endRad = (endAngle - 90) * (Math.PI / 180);

                  const x1 = 50 + 50 * Math.cos(startRad);
                  const y1 = 50 + 50 * Math.sin(startRad);
                  const x2 = 50 + 50 * Math.cos(endRad);
                  const y2 = 50 + 50 * Math.sin(endRad);

                  const textAngle = startAngle + angle / 2;
                  const textRad = (textAngle - 90) * (Math.PI / 180);
                  const tx = 50 + 34 * Math.cos(textRad);
                  const ty = 50 + 34 * Math.sin(textRad);

                  return (
                    <g key={index}>
                      <path
                        d={`M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`}
                        fill={slice.color}
                        stroke="#070919"
                        strokeWidth="1"
                      />
                      <text
                        x={tx}
                        y={ty}
                        fill="#FFFFFF"
                        fontSize="6.5"
                        fontWeight="900"
                        fontFamily="sans-serif"
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${textAngle}, ${tx}, ${ty})`}
                      >
                        {slice.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Center Hub */}
            <div className="absolute z-10 w-16 h-16 rounded-full bg-slate-950 border-4 border-amber-400 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.8)] pointer-events-none">
              <Gift size={20} className="text-amber-400" />
            </div>
          </div>
        </div>

        {/* Win Announcement */}
        {winResult !== null && (
          <div className="my-3 p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/70 text-center animate-bounce">
            <div className="flex items-center justify-center gap-2 text-emerald-300 font-heading font-black text-lg sm:text-xl">
              <Award size={22} className="text-amber-400" />
              <span>YOU WON ${Number(winResult).toFixed(2)} FREE CASH!</span>
            </div>
            <p className="text-xs text-emerald-200 mt-1">
              Credited directly to your wallet balance. Ready to play!
            </p>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="my-3 p-3 rounded-xl bg-red-950/70 border border-red-500/50 text-xs text-red-200 text-center flex items-center justify-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Button & Cooldown */}
        <div className="mt-4 space-y-3">
          {canSpin ? (
            <button
              onClick={handleSpin}
              disabled={spinning || loading}
              className="w-full py-4 rounded-2xl font-heading font-black text-lg tracking-wider bg-gradient-to-r from-amber-400 via-orange-500 to-[var(--neon-cyan)] text-black shadow-[0_0_30px_rgba(245,158,11,0.5)] hover:scale-101 active:scale-99 transition-all disabled:opacity-50"
            >
              {spinning ? 'SPINNING THE WHEEL...' : loading ? 'CHECKING...' : 'SPIN FOR FREE NOW!'}
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-amber-400 text-xs font-bold">
                <Clock size={16} />
                <span>NEXT FREE SPIN OPENS IN</span>
              </div>
              <div className="font-mono font-black text-2xl text-white tracking-widest">
                {countdownText || 'Tomorrow'}
              </div>
              <p className="text-[11px] text-slate-400">
                You already spun today! Check back when timer resets for another chance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
