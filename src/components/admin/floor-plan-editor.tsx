'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { updateTableLayout } from '@/server/actions/table.actions';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Table {
  id: string;
  name: string;
  seats: number;
  status: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  shape: string;
}

export function FloorPlanEditor({ initialTables }: { initialTables: Table[] }) {
  const [tables, setTables] = useState<Table[]>(initialTables);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Sync if props change
  useEffect(() => {
    setTables(initialTables);
  }, [initialTables]);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const rect = target.getBoundingClientRect();
    // Offset from the top-left of the table to the pointer
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    
    setDraggingId(id);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    
    // Calculate new position relative to container
    let newX = e.clientX - containerRect.left - dragOffset.current.x;
    let newY = e.clientY - containerRect.top - dragOffset.current.y;

    // Snap to 10px grid
    newX = Math.round(newX / 20) * 20;
    newY = Math.round(newY / 20) * 20;

    // Constrain to container
    const table = tables.find(t => t.id === draggingId);
    if (!table) return;

    newX = Math.max(0, Math.min(newX, containerRect.width - table.width));
    newY = Math.max(0, Math.min(newY, containerRect.height - table.height));

    setTables(prev => prev.map(t => 
      t.id === draggingId ? { ...t, positionX: newX, positionY: newY } : t
    ));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingId) return;
    
    const target = e.currentTarget as HTMLElement;
    target.releasePointerCapture(e.pointerId);
    
    const table = tables.find(t => t.id === draggingId);
    setDraggingId(null);

    // Save to Database
    if (table) {
      startTransition(async () => {
        const result = await updateTableLayout(table.id, {
          positionX: table.positionX,
          positionY: table.positionY,
        });
        if (!result.success) {
          toast.error("Failed to save layout");
        }
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center text-sm text-muted-foreground p-3 bg-muted rounded-md border border-border">
         <span>Drag tables to arrange your floor plan. Layout auto-saves on drop.</span>
         {isPending && <span className="animate-pulse font-medium text-primary">Saving...</span>}
      </div>

      <div 
        ref={containerRef}
        className="relative w-full h-[600px] bg-card border-2 border-dashed border-border rounded-lg overflow-hidden touch-none"
        style={{
          backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      >
        {tables.map((table, index) => {
          const isUnpositioned = table.positionX === 0 && table.positionY === 0;
          const px = isUnpositioned ? (index % 5) * 120 + 20 : table.positionX;
          const py = isUnpositioned ? Math.floor(index / 5) * 120 + 20 : table.positionY;

          return (
          <div
            key={table.id}
            onPointerDown={(e) => handlePointerDown(e, table.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className={cn(
              "absolute cursor-grab active:cursor-grabbing flex flex-col items-center justify-center p-2 border-2 shadow-sm transition-shadow",
              table.shape === 'ROUND' ? 'rounded-full' : 'rounded-md',
              draggingId === table.id ? 'z-50 ring-2 ring-primary shadow-xl opacity-90' : 'z-10 bg-background hover:border-primary',
              table.status === 'OCCUPIED' ? 'border-red-500 bg-red-50 text-red-900' : 
              table.status === 'BILL_PRINTED' ? 'border-yellow-500 bg-yellow-50 text-yellow-900' : 
              'border-emerald-500 text-emerald-950 dark:text-emerald-50'
            )}
            style={{
              left: `${px}px`,
              top: `${py}px`,
              width: `${table.width}px`,
              height: `${table.height}px`,
            }}
          >
            <span className="font-bold text-lg pointer-events-none">{table.name}</span>
            <span className="text-xs opacity-70 pointer-events-none">{table.seats} seats</span>
          </div>
          );
        })}
      </div>
    </div>
  );
}
