'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, SlidersHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { updateItemModifiers } from '@/server/actions/menu.actions';
import { ModifierGroupInput } from '@/types';
import { toast } from 'sonner';

interface ModifierManagerProps {
  menuItemId: string;
  itemName: string;
  initialGroups: ModifierGroupInput[];
}

export function ModifierManager({ menuItemId, itemName, initialGroups }: ModifierManagerProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<ModifierGroupInput[]>(initialGroups || []);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateItemModifiers(menuItemId, groups);
      if (result.success) {
        toast.success('Modifiers saved');
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const addGroup = () => {
    setGroups([...groups, { name: '', isRequired: false, maxChoices: null, modifiers: [] }]);
  };

  const updateGroup = (index: number, updates: Partial<ModifierGroupInput>) => {
    const updated = [...groups];
    updated[index] = { ...updated[index], ...updates };
    setGroups(updated);
  };

  const removeGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index));
  };

  const addModifier = (groupIndex: number) => {
    const updated = [...groups];
    updated[groupIndex].modifiers.push({ name: '', priceAdjustment: 0 });
    setGroups(updated);
  };

  const updateModifier = (groupIndex: number, modIndex: number, updates: any) => {
    const updated = [...groups];
    updated[groupIndex].modifiers[modIndex] = { ...updated[groupIndex].modifiers[modIndex], ...updates };
    setGroups(updated);
  };

  const removeModifier = (groupIndex: number, modIndex: number) => {
    const updated = [...groups];
    updated[groupIndex].modifiers = updated[groupIndex].modifiers.filter((_, i) => i !== modIndex);
    setGroups(updated);
  };

  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setOpen(true)} title="Manage Modifiers">
        <SlidersHorizontal className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifiers for {itemName}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {groups.map((group, gIdx) => (
              <div key={gIdx} className="border p-4 rounded-lg space-y-4 relative bg-slate-50/50">
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => removeGroup(gIdx)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
                
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>Group Name</Label>
                    <Input value={group.name} onChange={e => updateGroup(gIdx, { name: e.target.value })} placeholder="e.g. Meat Temperature" />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Choices</Label>
                    <Input type="number" placeholder="Leave empty for unlimited" value={group.maxChoices || ''} onChange={e => updateGroup(gIdx, { maxChoices: e.target.value ? parseInt(e.target.value) : null })} />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <Switch checked={group.isRequired} onCheckedChange={(c: boolean) => updateGroup(gIdx, { isRequired: c })} />
                    <Label>Required Selection</Label>
                </div>

                <div className="pl-4 border-l-2 space-y-3 mt-4">
                  <Label className="text-muted-foreground">Modifier Options</Label>
                  {group.modifiers.map((mod, mIdx) => (
                    <div key={mIdx} className="flex items-center gap-2">
                      <Input placeholder="Option Name (e.g. Rare)" value={mod.name} onChange={e => updateModifier(gIdx, mIdx, { name: e.target.value })} className="flex-1" />
                      <div className="flex items-center gap-2 w-32">
                         <span className="text-muted-foreground text-sm">+$</span>
                         <Input type="number" step="0.01" placeholder="0.00" value={mod.priceAdjustment || ''} onChange={e => updateModifier(gIdx, mIdx, { priceAdjustment: parseFloat(e.target.value) || 0 })} />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeModifier(gIdx, mIdx)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addModifier(gIdx)} className="mt-2">
                    <Plus className="w-4 h-4 mr-2" /> Add Option
                  </Button>
                </div>
              </div>
            ))}

            {groups.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                    No modifiers configured for this item.
                </div>
            )}

            <Button variant="secondary" className="w-full border-dashed" onClick={addGroup}>
              <Plus className="w-4 h-4 mr-2" /> Add Modifier Group
            </Button>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setGroups(initialGroups || []); setOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>{isPending ? 'Saving...' : 'Save Modifiers'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
