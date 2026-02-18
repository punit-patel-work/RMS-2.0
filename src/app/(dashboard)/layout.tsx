import { SessionProvider } from 'next-auth/react';
import { Sidebar } from '@/components/shared/sidebar';
import { getSidebarCounts } from '@/server/actions/kds.actions';

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
    </SessionProvider>
  );
}
