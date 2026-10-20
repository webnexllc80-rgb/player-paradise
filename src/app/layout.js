import './globals.css';
import GlobalLiveChat from '@/components/chat/GlobalLiveChat';
import PushNotificationManager from '@/components/common/PushNotificationManager';

export const metadata = {
  title: 'Players Paradise Hub | Official Cyber Gaming & Sweeps Hub',
  description:
    'Experience the next-generation cyber gaming destination. Get official login IDs for Ultra Panda, Fire Kirin, Orion Stars, Game Vault, and Panda 777 Slots. Instant Cash App & Crypto cashouts.',
  keywords:
    'Players Paradise Hub, Ultra Panda, Fire Kirin, Orion Stars, Game Vault, Milky Way, Sweeps Casino, Instant Cashout, Cash App casino',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' },
      { url: '/apple-touch-icon-152x152.png', sizes: '152x152', type: 'image/png' },
      { url: '/apple-touch-icon-120x120.png', sizes: '120x120', type: 'image/png' },
    ],
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/apple-touch-icon.png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Players Paradise',
  },
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#050711',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180x180.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon-152x152.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon-120x120.png" />
        <link rel="apple-touch-icon-precomposed" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Players Paradise" />
      </head>
      <body className="antialiased selection:bg-[var(--neon-cyan)] selection:text-black">
        <PushNotificationManager />
        {children}
        <GlobalLiveChat />
      </body>
    </html>
  );
}
