import { SessionProvider } from 'next-auth/react';
import { Sidebar } from '@/components/shared/sidebar';
import { getSidebarCounts } from '@/server/actions/kds.actions';
import { KeyboardShortcutsProvider } from '@/components/shared/keyboard-shortcuts';

// Every dashboard route is per-session (auth() reads cookies via headers()),
// so static prerender attempts are guaranteed to throw DYNAMIC_SERVER_USAGE.
// Telling Next.js up front prevents the build-time probe and the noisy
// "Failed to fetch sidebar counts" log lines that come from the catch block
// swallowing the dynamic-render signal.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const counts = await getSidebarCounts();

  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar initialCounts={counts} />
        {/* Main content — left padding on mobile for hamburger button */}
        <main className="flex-1 overflow-auto bg-background">
          {/* Spacer for mobile hamburger button */}
          <div className="h-12 lg:hidden" />
          {children}
        </main>
      </div>
      <KeyboardShortcutsProvider />
    </SessionProvider>
  );
}
