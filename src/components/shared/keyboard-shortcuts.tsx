'use client';

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Renders the keyboard shortcuts overlay and listens for shortcuts.
 * Add this once at the dashboard layout level.
 */
export function KeyboardShortcutsProvider() {
  const { showHelp, setShowHelp, shortcuts } = useKeyboardShortcuts();

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="bg-background border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-muted-foreground" />
            Keyboard Shortcuts
          </h2>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowHelp(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts
            .filter((s) => s.key !== 'Escape')
            .map((s) => (
              <div
                key={`${s.ctrl ? 'ctrl-' : ''}${s.key}`}
                className="flex items-center justify-between py-1.5"
              >
                <span className="text-sm text-muted-foreground">
                  {s.description}
                </span>
                <kbd
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded border',
                    'bg-muted text-xs font-mono font-semibold text-foreground'
                  )}
                >
                  {s.ctrl && <span>Ctrl +</span>}
                  <span>{s.key === '/' ? '/' : s.key}</span>
                </kbd>
              </div>
            ))}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-sm text-muted-foreground">Close this overlay</span>
            <kbd className="inline-flex items-center gap-1 px-2 py-0.5 rounded border bg-muted text-xs font-mono font-semibold text-foreground">
              Esc
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
