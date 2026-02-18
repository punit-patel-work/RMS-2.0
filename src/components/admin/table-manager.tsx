'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, Users } from 'lucide-react';
import { createTable, deleteTable } from '@/server/actions/table.actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Table {
  id: string;
  name: string;
  seats: number;
  status: string;
}

export function TableManager({ tables }: { tables: Table[] }) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('4');
  const router = useRouter();

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createTable(name, parseInt(seats));
      if (result.success) {
        toast.success('Table created');
        setDialogOpen(false);
        setName('');
        setSeats('4');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteTable(id);
      if (result.success) {
        toast.success('Table deleted');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Table
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {tables.map((table) => (
          <Card key={table.id}>
            <CardContent className="p-4 text-center space-y-2">
              <h3 className="text-xl font-bold">{table.name}</h3>
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{table.seats} seats</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {table.status}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive"
                onClick={() => handleDelete(table.id)}
                disabled={isPending || table.status !== 'VACANT'}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Table</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Table Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="T11"
              />
            </div>
            <div className="space-y-2">
              <Label>Seats</Label>
              <Input
                type="number"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                placeholder="4"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
