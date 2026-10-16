'use client';

import { useEffect } from 'react';

export default function PushNotificationManager() {
  useEffect(() => {
    // 1. Check if running inside native Capacitor (Android APK / iOS app)
    const initCapacitorPush = async () => {
      try {
        if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          const permStatus = await PushNotifications.requestPermissions();

          if (permStatus.receive === 'granted') {
            await PushNotifications.register();

            PushNotifications.addListener('registration', async (token) => {
              try {
                await fetch('/api/notifications', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    token: token.value,
                    device: 'android_apk',
                  }),
                });
              } catch {}
            });

            PushNotifications.addListener('pushNotificationReceived', (notification) => {
              console.log('Push received in APK:', notification);
            });
          }
          return true;
        }
      } catch (err) {
        console.warn('Capacitor push init note:', err.message);
      }
      return false;
    };

    // 2. Browser Service Worker for Chrome & Safari iOS PWA
    const initBrowserPush = async () => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        // If Notification API is available
        if ('Notification' in window) {
          if (Notification.permission === 'granted') {
            await fetch('/api/notifications', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ device: 'web_chrome' }),
            }).catch(() => {});
          } else if (Notification.permission === 'default') {
            // Optional: Request permission after user interaction or delay
            const timer = setTimeout(() => {
              Notification.requestPermission().then(async (perm) => {
                if (perm === 'granted') {
                  await fetch('/api/notifications', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ device: 'web_chrome' }),
                  }).catch(() => {});
                }
              }).catch(() => {});
            }, 6000);
            return () => clearTimeout(timer);
          }
        }
      } catch (swErr) {
        console.warn('Service worker registration note:', swErr.message);
      }
    };

    initCapacitorPush().then((isNative) => {
      if (!isNative) {
        initBrowserPush();
      }
    });
  }, []);

  return null;
}
