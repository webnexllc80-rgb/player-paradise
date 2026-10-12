import './globals.css';

export const metadata = {
  title: 'Players Paradise Hub | Official Cyber Gaming & Sweeps Hub',
  description:
    'Experience the next-generation cyber gaming destination. Get official login IDs for Ultra Panda, Fire Kirin, Orion Stars, Game Vault, and Panda 777 Slots. Instant Cash App & Crypto cashouts.',
  keywords:
    'Players Paradise Hub, Ultra Panda, Fire Kirin, Orion Stars, Game Vault, Milky Way, Sweeps Casino, Instant Cashout, Cash App casino',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#00f0ff',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo.png" />
      </head>
      <body className="antialiased selection:bg-[var(--neon-cyan)] selection:text-black">
        {children}
      </body>
    </html>
  );
}
