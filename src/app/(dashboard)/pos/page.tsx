import { getAllTables } from '@/server/queries/table.queries';
import { TableGrid } from '@/components/pos/table-grid';
import Link from 'next/link';
import { Zap, Package } from 'lucide-react';
import { toPlain } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export default async function POSPage() {
  const tables = await getAllTables();

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header — stacks on smaller screens */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Table Grid</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Select a table to start an order
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 md:gap-6">
          <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Vacant</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Occupied</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">Bill Printed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-violet-500" />
              <span className="text-muted-foreground">Reservation</span>
            </div>
          </div>
          {/* U-H4: was bg-blue-600 / bg-purple-600 hard-coded — broke dark
              mode contrast. Now uses theme-driven primary/secondary tokens
              that respect both light & dark. */}
          <Link href="/pos/quick-sale" aria-label="Start a Quick Sale order">
            <button className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-sm text-sm md:text-base">
              <Zap className="w-4 h-4" aria-hidden="true" /> Quick Sale
            </button>
          </Link>
          <Link href="/pos/takeout" aria-label="Start a new Takeout order">
            <button className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 rounded-lg bg-secondary text-secondary-foreground border border-border font-semibold hover:bg-secondary/80 transition-colors shadow-sm text-sm md:text-base">
              <Package className="w-4 h-4" aria-hidden="true" /> New Takeout
            </button>
          </Link>
        </div>
      </div>

      <TableGrid tables={toPlain(tables)} />
    </div>
  );
}
