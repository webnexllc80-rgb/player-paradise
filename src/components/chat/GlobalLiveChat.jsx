'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import LiveChatWidget from './LiveChatWidget';

export default function GlobalLiveChat() {
  const pathname = usePathname();

  // Exclude admin panel to prevent overlap with admin concierge desk
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return <LiveChatWidget />;
}
