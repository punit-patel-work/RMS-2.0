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
import { Plus, Trash2, Users, LayoutDashboard, List } from 'lucide-react';
import { createTable, deleteTable } from '@/server/actions/table.actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { FloorPlanEditor } from './floor-plan-editor';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

export function TableManager({ tables }: { tables: Table[] }) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [seats, setSeats] = useState('4');
  const [shape, setShape] = useState('SQUARE');
  const router = useRouter();

  const handleCreate = () => {
    startTransition(async () => {
      const result = await createTable(name, parseInt(seats), shape);
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
      <Tabs defaultValue="floorplan" className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="floorplan" className="gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Floor Plan
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="w-4 h-4" />
              List View
            </TabsTrigger>
          </TabsList>
          
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Table
          </Button>
        </div>

        <TabsContent value="floorplan" className="mt-0">
          <FloorPlanEditor initialTables={tables} />
        </TabsContent>

        <TabsContent value="list" className="mt-0 space-y-4">
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
        </TabsContent>
      </Tabs>

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
            
            <div className="space-y-2">
              <Label>Shape</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={shape}
                onChange={(e) => setShape(e.target.value)}
              >
                <option value="SQUARE">Square / Rectangle</option>
                <option value="ROUND">Round</option>
              </select>
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
