'use client';


import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { getSidebarCounts } from '@/server/actions/kds.actions';
import {
  LayoutGrid,
  ChefHat,
  UtensilsCrossed,
  BarChart3,
  Tag,
  Settings,
  LogOut,
  User,
  ConciergeBell,
  ClipboardList,
  Users,
  Menu,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useConnectionStatus } from '@/hooks/use-connection-status';

const navItems = [
  {
    label: 'POS',
    href: '/pos',
    icon: LayoutGrid,
    roles: ['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'],
  },
  {
    label: 'Kitchen',
    href: '/kds',
    icon: ChefHat,
    roles: ['OWNER', 'SUPERVISOR', 'FLOOR_STAFF', 'KITCHEN_STAFF'],
  },
  {
    label: 'Serve',
    href: '/serve',
    icon: ConciergeBell,
    roles: ['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'],
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: ClipboardList,
    roles: ['OWNER', 'SUPERVISOR', 'FLOOR_STAFF'],
  },
  {
    label: 'Menu',
    href: '/admin/menu',
    icon: UtensilsCrossed,
    roles: ['OWNER', 'SUPERVISOR'],
    section: 'Admin',
  },
  {
    label: 'Promotions',
    href: '/admin/promotions',
    icon: Tag,
    roles: ['OWNER', 'SUPERVISOR'],
  },
  {
    label: 'Tables',
    href: '/admin/tables',
    icon: Settings,
    roles: ['OWNER', 'SUPERVISOR'],
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    roles: ['OWNER', 'SUPERVISOR'],
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    roles: ['OWNER'],
  },
];

export function Sidebar({ initialCounts }: { initialCounts?: { pending: number; ready: number } }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);

  useConnectionStatus();

  const visibleItems = navItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const mainItems = visibleItems.filter((i) => !i.href.startsWith('/admin'));
  const adminItems = visibleItems.filter((i) => i.href.startsWith('/admin'));

  const [counts, setCounts] = useState(initialCounts || { pending: 0, ready: 0 });

  useEffect(() => {
    if (initialCounts) {
        setCounts(initialCounts);
    }
  }, [initialCounts]);

  useEffect(() => {
    // Initial fetch (only if no initial data, or to refresh)
    if (!initialCounts) {
        getSidebarCounts().then(setCounts);
    }

    // Poll every 30 seconds
    const interval = setInterval(() => {
      getSidebarCounts().then(setCounts);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getBadge = (screen: string) => {
    if (screen === 'Kitchen' && counts.pending > 0) return counts.pending;
    if (screen === 'Serve' && counts.ready > 0) return counts.ready;
    return null;
  };

  const NavContent = ({ collapsed = false }: { collapsed?: boolean }) => (
    <>
      {/* Logo */}
      <div className={cn('p-4', collapsed ? 'flex justify-center' : 'px-6 py-5')}>
        <h1 className={cn('font-bold tracking-tight flex items-center gap-2', collapsed ? 'text-base' : 'text-xl')}>
          <span className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
            R
          </span>
          {!collapsed && 'RMS'}
        </h1>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 p-2 lg:p-3 space-y-0.5">
        {mainItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
                title={collapsed ? item.label : undefined}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5 shrink-0" />
                  {collapsed && getBadge(item.label) && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
                      {getBadge(item.label)}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <div className="flex-1 flex justify-between items-center">
                    <span>{item.label}</span>
                    {getBadge(item.label) && (
                      <Badge variant="destructive" className="h-5 px-1.5 min-w-[1.25rem] flex items-center justify-center text-[10px]">
                        {getBadge(item.label)}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}

        {adminItems.length > 0 && (
          <>
            <div className={cn('pt-3 pb-1', collapsed ? 'flex justify-center' : '')}>
              {collapsed ? (
                <Separator className="w-6" />
              ) : (
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3">
                  Admin
                </span>
              )}
            </div>
            {adminItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {!collapsed && item.label}
                  </div>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      <Separator />

      {/* User Info + Logout */}
      <div className={cn('p-3 space-y-2', collapsed ? 'flex flex-col items-center' : '')}>
        {!collapsed && (
          <div className="flex items-center gap-3 px-3">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {session?.user?.name ?? 'Staff'}
              </p>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {userRole}
              </Badge>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'text-muted-foreground hover:text-destructive',
            collapsed ? 'w-10 h-10 p-0' : 'w-full justify-start gap-2'
          )}
          onClick={() => signOut({ callbackUrl: '/login' })}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && 'Sign Out'}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* ─── Mobile/Tablet Hamburger ─────────────────── */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </Button>

      {/* ─── Mobile/Tablet Overlay Sidebar ───────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <NavContent />
      </aside>

      {/* ─── Desktop Collapsed (md-lg) ───────────────── */}
      <aside className="hidden lg:flex xl:hidden w-16 h-screen bg-card border-r border-border flex-col shrink-0">
        <NavContent collapsed />
      </aside>

      {/* ─── Desktop Full (xl+) ──────────────────────── */}
      <aside className="hidden xl:flex w-64 h-screen bg-card border-r border-border flex-col shrink-0">
        <NavContent />
      </aside>
    </>
  );
}
