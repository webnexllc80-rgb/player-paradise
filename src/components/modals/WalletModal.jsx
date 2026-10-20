'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * WalletModal
 * Replaced legacy modal dialog with direct navigation to the dedicated /deposit or /withdraw form pages.
 */
export default function WalletModal({
  isOpen,
  onClose,
  initialTab = 'deposit',
}) {
  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      if (typeof onClose === 'function') {
        onClose();
      }
      const target =
        initialTab === 'redeem' || initialTab === 'cashout' || initialTab === 'withdraw'
          ? '/withdraw'
          : '/deposit';
      router.push(target);
    }
  }, [isOpen, initialTab, onClose, router]);

  return null;
}
