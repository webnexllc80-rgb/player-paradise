'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, X, ExternalLink, Sparkles, ShieldCheck } from 'lucide-react';
import { playTune, unlockAudioContext } from '@/lib/soundAlerts';

export default function PushNotificationManager() {
  const router = useRouter();
  const [activeToast, setActiveToast] = useState(null);
  const [toastProgress, setToastProgress] = useState(100);
  const lastSeenIdRef = useRef(null);
  const isInitialRef = useRef(true);
  const toastTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Helper to trigger native Chrome desktop notification
  const triggerChromeDesktopNotification = (item) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready
            .then((reg) => {
              reg.showNotification(item.title || 'Players Paradise Hub', {
                body: item.message || 'You have a new alert waiting in your dashboard!',
                icon: '/logo.png',
                badge: '/logo.png',
                tag: 'pp-alert-' + (item.id || Date.now()),
                renotify: true,
                vibrate: [200, 100, 200],
                data: { url: item.url || '/' },
              });
            })
            .catch(() => {
              new Notification(item.title || 'Players Paradise Hub', {
                body: item.message || 'You have a new alert waiting in your dashboard!',
                icon: '/logo.png',
                tag: 'pp-alert-' + (item.id || Date.now()),
              });
            });
        } else {
          new Notification(item.title || 'Players Paradise Hub', {
            body: item.message || 'You have a new alert waiting in your dashboard!',
            icon: '/logo.png',
            tag: 'pp-alert-' + (item.id || Date.now()),
          });
        }
      } catch (err) {
        console.warn('Chrome notification dispatch notice:', err);
      }
    }
  };

  // Helper to show In-App Pop-Up Toast
  const showInAppToast = (item) => {
    // Play sci-fi audio alert
    try {
      unlockAudioContext();
      playTune('cyber', 0.65);
    } catch {}

    setActiveToast(item);
    setToastProgress(100);

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    const totalDuration = 7000;
    const intervalStep = 100;
    let elapsed = 0;

    progressIntervalRef.current = setInterval(() => {
      elapsed += intervalStep;
      const remainingPct = Math.max(0, 100 - (elapsed / totalDuration) * 100);
      setToastProgress(remainingPct);
      if (elapsed >= totalDuration) {
        clearInterval(progressIntervalRef.current);
      }
    }, intervalStep);

    toastTimerRef.current = setTimeout(() => {
      setActiveToast(null);
    }, totalDuration);
  };

  // Combined dispatch for incoming notification
  const dispatchAlert = (item) => {
    triggerChromeDesktopNotification(item);
    showInAppToast(item);
  };

  // Request Chrome permission on user interaction or mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      const askPermission = () => {
        Notification.requestPermission()
          .then((perm) => {
            if (perm === 'granted') {
              triggerChromeDesktopNotification({
                title: '🔔 Notifications Enabled!',
                message: 'You will now receive instant alerts for deposits, cashouts, and game IDs.',
              });
            }
          })
          .catch(() => {});
      };

      // Ask after short delay or first click
      const timer = setTimeout(askPermission, 3500);
      window.addEventListener('click', askPermission, { once: true });
      return () => {
        clearTimeout(timer);
        window.removeEventListener('click', askPermission);
      };
    }
  }, []);

  // Poll for incoming notifications in real time
  useEffect(() => {
    let isCancelled = false;

    const checkIncomingNotifications = async () => {
      if (document.hidden) return; // Save VPS resources when tab inactive
      try {
        const res = await fetch('/api/notifications', { cache: 'no-store' });
        const data = await res.json();
        if (isCancelled || !data.success || !Array.isArray(data.notifications)) return;

        const notifs = data.notifications;
        if (notifs.length === 0) return;

        const newest = notifs[0];

        // On first run, record the newest ID so we don't spam old alerts
        if (isInitialRef.current) {
          lastSeenIdRef.current = newest.id;
          isInitialRef.current = false;
          return;
        }

        // If a new notification arrived with a different ID
        if (newest.id && newest.id !== lastSeenIdRef.current) {
          lastSeenIdRef.current = newest.id;
          dispatchAlert(newest);
        }
      } catch {
        // silent fail
      }
    };

    checkIncomingNotifications();
    const interval = setInterval(checkIncomingNotifications, 4000);

    // Event listener for manual test or in-app triggers
    const handleCustomTrigger = (e) => {
      if (e.detail) dispatchAlert(e.detail);
    };

    window.addEventListener('paradise-show-notification', handleCustomTrigger);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      window.removeEventListener('paradise-show-notification', handleCustomTrigger);
    };
  }, []);

  // Service worker registration
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }
  }, []);

  if (!activeToast) return null;

  return (
    <div
      role="alert"
      className="fixed top-4 right-4 z-[9999] max-w-sm w-full mx-auto p-4 rounded-2xl bg-[#090d1a]/95 backdrop-blur-2xl border border-cyan-400/50 shadow-[0_12px_40px_rgba(0,240,255,0.35)] animate-in slide-in-from-top duration-300 overflow-hidden"
      style={{
        boxShadow: '0 0 25px rgba(0, 240, 255, 0.25), inset 0 0 15px rgba(0, 240, 255, 0.1)',
      }}
    >
      {/* Top Banner Content */}
      <div className="flex items-start gap-3">
        {/* Glowing Icon */}
        <div className="relative shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-cyan-400/60 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.4)]">
          <Bell size={18} className="animate-bounce" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-400" />
        </div>

        {/* Message Text */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-500/30">
              ALERT
            </span>
            <span className="text-[10px] text-slate-400">Just now</span>
          </div>

          <h4 className="text-xs font-heading font-black text-white truncate tracking-wide">
            {activeToast.title || 'Players Paradise Alert'}
          </h4>

          <p className="text-[11px] text-slate-300 mt-0.5 leading-snug line-clamp-2">
            {activeToast.message}
          </p>

          {/* Quick Action Button */}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={() => {
                setActiveToast(null);
                if (activeToast.url && activeToast.url !== '/') {
                  router.push(activeToast.url);
                } else {
                  // Trigger notification modal open event
                  window.dispatchEvent(new CustomEvent('paradise-open-notifications'));
                }
              }}
              className="px-3 py-1 rounded-lg bg-gradient-to-r from-cyan-400 to-teal-400 text-black text-[11px] font-heading font-black hover:scale-102 active:scale-98 transition-all flex items-center gap-1 shadow-[0_0_10px_rgba(0,240,255,0.4)]"
            >
              <span>VIEW</span>
              <ExternalLink size={11} strokeWidth={3} />
            </button>

            <button
              onClick={() => setActiveToast(null)}
              className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setActiveToast(null)}
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
          title="Close alert"
        >
          <X size={15} />
        </button>
      </div>

      {/* Auto-Dismiss Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800/80">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(0,240,255,0.7)]"
          style={{ width: `${toastProgress}%` }}
        />
      </div>
    </div>
  );
}
