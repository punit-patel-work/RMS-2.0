'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Users,
  Link2,
  Unlink,
  CalendarClock,
  XCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/pricing';
import {
  reserveTable,
  cancelReservation,
  mergeTables,
  demergeTables,
} from '@/server/actions/table.actions';
import { toast } from 'sonner';

interface ReservationData {
  id: string;
  guestName: string;
  reservedAt: string;
  reservedUntil: string;
}

interface TableData {
  id: string;
  name: string;
  seats: number;
  status: 'VACANT' | 'OCCUPIED' | 'BILL_PRINTED';
  mergedIntoId?: string | null;
  mergedFrom?: { id: string; name: string }[];
  reservations?: ReservationData[];
  currentOrder?: {
    id: string;
    total: number;
    items: Array<{ id: string }>;
  } | null;
}

const statusConfig: Record<string, { bg: string; dot: string; text: string }> = {
  VACANT: {
    bg: 'bg-emerald-500/10 border-emerald-500/50 hover:bg-emerald-500/20',
    dot: 'bg-emerald-500',
    text: 'Vacant',
  },
  OCCUPIED: {
    bg: 'bg-red-500/10 border-red-500/50 hover:bg-red-500/20',
    dot: 'bg-red-500',
    text: 'Occupied',
  },
  BILL_PRINTED: {
    bg: 'bg-amber-500/10 border-amber-500/50 hover:bg-amber-500/20',
    dot: 'bg-amber-500',
    text: 'Bill Printed',
  },
};

// Find the next upcoming reservation that's within 30 minutes
function getUpcomingWarning(reservations: ReservationData[] | undefined): ReservationData | null {
  if (!reservations?.length) return null;
  const now = Date.now();
  const thirtyMins = 30 * 60 * 1000;

  for (const r of reservations) {
    const start = new Date(r.reservedAt).getTime();
    const end = new Date(r.reservedUntil).getTime();

    // Within window: 30 min before start to end time
    if (now >= start - thirtyMins && now < end) {
      return r;
    }
  }
  return null;
}

export function TableGrid({ tables }: { tables: TableData[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id ?? '';
  const [isPending, startTransition] = useTransition();

  // Reserve dialog
  const [reserveId, setReserveId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [reserveDate, setReserveDate] = useState('');
  const [reserveStart, setReserveStart] = useState('');
  const [reserveEnd, setReserveEnd] = useState('');

  // Merge dialog
  const [mergeParentId, setMergeParentId] = useState<string | null>(null);
  const [mergeChildIds, setMergeChildIds] = useState<string[]>([]);

  // Reservations list dialog
  const [viewReservationsTable, setViewReservationsTable] = useState<TableData | null>(null);

  // Filter out tables that are merged into another
  const visibleTables = tables.filter((t) => !t.mergedIntoId);

  const handleReserve = () => {
    if (!reserveId || !guestName.trim() || !reserveDate || !reserveStart || !reserveEnd) {
      toast.error('Fill in all reservation fields');
      return;
    }
    const startDt = new Date(`${reserveDate}T${reserveStart}`);
    const endDt = new Date(`${reserveDate}T${reserveEnd}`);
    if (endDt <= startDt) {
      toast.error('End time must be after start time');
      return;
    }
    startTransition(async () => {
      const result = await reserveTable({
        tableId: reserveId,
        userId,
        guestName: guestName.trim(),
        reservedAt: startDt,
        reservedUntil: endDt,
      });
      if (result.success) {
        toast.success('Table reserved');
        setReserveId(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleCancelReservation = (reservationId: string) => {
    startTransition(async () => {
      const result = await cancelReservation(reservationId);
      if (result.success) {
        toast.success('Reservation cancelled');
        setViewReservationsTable(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleMerge = () => {
    if (!mergeParentId || mergeChildIds.length === 0) {
      toast.error('Select at least one table to merge');
      return;
    }
    startTransition(async () => {
      const result = await mergeTables(mergeParentId, mergeChildIds);
      if (result.success) {
        toast.success('Tables merged');
        setMergeParentId(null);
        setMergeChildIds([]);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDemerge = (parentId: string) => {
    startTransition(async () => {
      const result = await demergeTables(parentId);
      if (result.success) {
        toast.success('Tables separated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-4">
        {visibleTables.map((table) => {
          const config = statusConfig[table.status] || statusConfig.VACANT;
          const hasMergedChildren = table.mergedFrom && table.mergedFrom.length > 0;
          const upcomingWarning = getUpcomingWarning(table.reservations);
          const reservationCount = table.reservations?.length ?? 0;

          return (
            <Card
              key={table.id}
              className={cn(
                'cursor-pointer border-2 transition-all duration-200 active:scale-[0.97] relative',
                config.bg,
                upcomingWarning && 'ring-2 ring-amber-400/60'
              )}
              onClick={() => router.push(`/pos/${table.id}`)}
            >
              <CardContent className="p-3 md:p-4 space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h3 className="text-lg font-bold truncate">{table.name}</h3>
                    {hasMergedChildren && (
                      <Badge variant="outline" className="text-[10px] gap-0.5 shrink-0 px-1">
                        <Link2 className="w-2.5 h-2.5" />
                        +{table.mergedFrom!.length}
                      </Badge>
                    )}
                  </div>
                  <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', config.dot)} />
                </div>

                {/* Seats */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3.5 h-3.5" />
                  <span>{table.seats} seats</span>
                </div>

                {/* ⚠️ Upcoming Reservation Warning */}
                {upcomingWarning && (
                  <div className="flex items-start gap-1.5 p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold text-amber-700 dark:text-amber-400">
                        {upcomingWarning.guestName}
                      </p>
                      <p className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(upcomingWarning.reservedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' – '}
                        {new Date(upcomingWarning.reservedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )}

                {/* Current Order */}
                {table.currentOrder && (
                  <div className="pt-1.5 border-t border-border/50 space-y-0.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Items</span>
                      <span className="font-medium">
                        {table.currentOrder.items.length}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Total</span>
                      <span className="font-semibold">
                        {formatCurrency(table.currentOrder.total)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Status Badge */}
                <Badge
                  variant="secondary"
                  className="text-[10px] w-full justify-center"
                >
                  {config.text}
                  {reservationCount > 0 && (
                    <span className="ml-1 text-violet-600">
                      · {reservationCount} res
                    </span>
                  )}
                </Badge>

                {/* Action Buttons — 2-col grid to prevent overflow */}
                <div
                  className="grid grid-cols-2 gap-1 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Reserve — always available unless merged child */}
                  {!table.mergedIntoId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] gap-0.5 h-7 px-1.5"
                      onClick={() => {
                        setReserveId(table.id);
                        setGuestName('');
                        const now = new Date();
                        setReserveDate(now.toISOString().split('T')[0]);
                        const h = now.getHours() + 1;
                        setReserveStart(`${String(h).padStart(2, '0')}:00`);
                        setReserveEnd(`${String(h + 2).padStart(2, '0')}:00`);
                      }}
                    >
                      <CalendarClock className="w-3 h-3" />
                      <span className="hidden sm:inline">Reserve</span>
                    </Button>
                  )}

                  {/* Merge — only VACANT, non-merged */}
                  {table.status === 'VACANT' && !table.mergedIntoId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] gap-0.5 h-7 px-1.5"
                      onClick={() => {
                        setMergeParentId(table.id);
                        setMergeChildIds([]);
                      }}
                    >
                      <Link2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Merge</span>
                    </Button>
                  )}

                  {/* View Reservations */}
                  {reservationCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] gap-0.5 h-7 px-1.5 text-violet-600"
                      onClick={() => setViewReservationsTable(table)}
                    >
                      <CalendarClock className="w-3 h-3" />
                      <span className="hidden sm:inline">{reservationCount} Res</span>
                      <span className="sm:hidden">{reservationCount}</span>
                    </Button>
                  )}

                  {/* Split merged */}
                  {hasMergedChildren && table.status !== 'OCCUPIED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[10px] gap-0.5 h-7 px-1.5"
                      onClick={() => handleDemerge(table.id)}
                      disabled={isPending}
                    >
                      <Unlink className="w-3 h-3" />
                      <span className="hidden sm:inline">Split</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ─── Reserve Dialog ──────────────────────────────── */}
      <Dialog open={reserveId !== null} onOpenChange={(o) => { if (!o) setReserveId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-violet-500" />
              Reserve {tables.find((t) => t.id === reserveId)?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Show existing reservations on this table */}
          {(() => {
            const t = tables.find((t) => t.id === reserveId);
            const res = t?.reservations ?? [];
            if (res.length === 0) return null;
            return (
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground">Existing Reservations:</p>
                {res.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{r.guestName}</span>
                    <span className="text-muted-foreground">
                      {new Date(r.reservedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      –
                      {new Date(r.reservedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Guest Name *</Label>
              <Input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Guest name"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date *</Label>
              <Input
                type="date"
                value={reserveDate}
                onChange={(e) => setReserveDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Start *</Label>
                <Input
                  type="time"
                  value={reserveStart}
                  onChange={(e) => setReserveStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End *</Label>
                <Input
                  type="time"
                  value={reserveEnd}
                  onChange={(e) => setReserveEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReserveId(null)}>
              Cancel
            </Button>
            <Button onClick={handleReserve} disabled={isPending}>
              {isPending ? 'Reserving...' : 'Reserve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── View Reservations Dialog ────────────────────── */}
      <Dialog
        open={viewReservationsTable !== null}
        onOpenChange={(o) => { if (!o) setViewReservationsTable(null); }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-violet-500" />
              {viewReservationsTable?.name} — Reservations
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(viewReservationsTable?.reservations ?? []).map((r) => {
              const start = new Date(r.reservedAt);
              const end = new Date(r.reservedUntil);
              const now = Date.now();
              const isUpcoming = start.getTime() - now < 30 * 60 * 1000 && now < end.getTime();

              return (
                <div
                  key={r.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border',
                    isUpcoming
                      ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                      : 'border-border'
                  )}
                >
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      {isUpcoming && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                      {r.guestName}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {start.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      {' '}
                      {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600 shrink-0"
                    onClick={() => handleCancelReservation(r.id)}
                    disabled={isPending}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
            {(viewReservationsTable?.reservations ?? []).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">
                No reservations
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Merge Dialog ────────────────────────────────── */}
      <Dialog open={mergeParentId !== null} onOpenChange={(o) => { if (!o) setMergeParentId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-blue-500" />
              Merge Tables
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Select vacant tables to merge with{' '}
            <strong>{tables.find((t) => t.id === mergeParentId)?.name}</strong>
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {tables
              .filter((t) => t.id !== mergeParentId && t.status === 'VACANT' && !t.mergedIntoId)
              .map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={mergeChildIds.includes(t.id)}
                    onCheckedChange={(checked: boolean) =>
                      setMergeChildIds((prev) =>
                        checked ? [...prev, t.id] : prev.filter((id) => id !== t.id)
                      )
                    }
                  />
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{t.seats} seats</span>
                </label>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeParentId(null)}>
              Cancel
            </Button>
            <Button onClick={handleMerge} disabled={isPending || mergeChildIds.length === 0}>
              {isPending ? 'Merging...' : `Merge ${mergeChildIds.length} Table${mergeChildIds.length > 1 ? 's' : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
