'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface ShortcutEntry {
  key: string;
  ctrl?: boolean;
  description: string;
  action: () => void;
}

/**
 * Global keyboard shortcuts for the POS dashboard.
 * Press Ctrl+/ to show a help overlay with all available shortcuts.
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts: ShortcutEntry[] = [
    { key: '/', ctrl: true, description: 'Show keyboard shortcuts', action: () => setShowHelp((prev) => !prev) },
    { key: '1', ctrl: true, description: 'Go to POS', action: () => router.push('/pos') },
    { key: '2', ctrl: true, description: 'Go to Kitchen (KDS)', action: () => router.push('/kds') },
    { key: '3', ctrl: true, description: 'Go to Serve', action: () => router.push('/serve') },
    { key: '4', ctrl: true, description: 'Go to Orders', action: () => router.push('/orders') },
    { key: 'Escape', description: 'Close dialog / help overlay', action: () => setShowHelp(false) },
  ];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        if (e.key === 'Escape') {
          // Always allow Escape
        } else {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
        if (e.key === shortcut.key && ctrlMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [pathname] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp, shortcuts };
}
