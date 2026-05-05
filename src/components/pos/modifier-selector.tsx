'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/pricing';
import { Checkbox } from '@/components/ui/checkbox';

interface ModifierSelectorProps {
  item: any | null; // Pass item to open, null to close
  modifierGroups: any[]; // The nested groups and modifiers from the Prisma query
  onCancel: () => void;
  onConfirm: (item: any, selectedModifiers: any[]) => void;
}

export function ModifierSelector({ item, modifierGroups, onCancel, onConfirm }: ModifierSelectorProps) {
  // state for selections: { [groupId]: [modifierId1, modifierId2] }
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  
  useEffect(() => {
    if (item) setSelections({});
  }, [item]);

  if (!item || !modifierGroups || modifierGroups.length === 0) return null;

  const toggleSelection = (groupId: string, modifierId: string, maxChoices: number | null) => {
    setSelections(prev => {
      const current = prev[groupId] || [];
      if (current.includes(modifierId)) {
        return { ...prev, [groupId]: current.filter(id => id !== modifierId) };
      }
      
      // If adding, check maxChoices
      if (maxChoices === 1) {
        return { ...prev, [groupId]: [modifierId] }; // Radio behavior
      }
      
      if (maxChoices && current.length >= maxChoices) {
        return prev; // Reached limit
      }

      return { ...prev, [groupId]: [...current, modifierId] };
    });
  };

  const getSelectedModifierObjects = () => {
    const selected: any[] = [];
    modifierGroups.forEach(g => {
      const mods = selections[g.id] || [];
      g.modifiers.forEach((m: any) => {
        if (mods.includes(m.id)) {
          selected.push({
            modifierId: m.id,
            name: m.name,
            priceAdjustment: Number(m.priceAdjustment || 0)
          });
        }
      });
    });
    return selected;
  };

  const isValid = modifierGroups.every(g => {
    if (!g.isRequired) return true;
    return (selections[g.id]?.length || 0) > 0;
  });

  const currentTotal = item.basePrice + getSelectedModifierObjects().reduce((sum, m) => sum + m.priceAdjustment, 0);

  // U-H1: don't lose in-progress selections to a misclick on the backdrop.
  // Confirm before auto-cancelling once the user has picked at least one
  // modifier; opening the dialog is fine, closing-with-data needs a prompt.
  const hasSelections = Object.values(selections).some((ids) => ids.length > 0);
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (hasSelections && !window.confirm('Discard your modifier selections?')) {
        return;
      }
      onCancel();
    }
  };

  return (
    <Dialog open={!!item} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Customize {item.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4 px-1">
          {modifierGroups.map(group => {
            const currentSelected = selections[group.id] || [];
            return (
              <div key={group.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">{group.name}</Label>
                  <span className="text-xs text-muted-foreground">
                    {group.isRequired ? 'Required' : 'Optional'} 
                    {group.maxChoices ? ` (Max ${group.maxChoices})` : ''}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.modifiers.map((mod: any) => {
                    const isSelected = currentSelected.includes(mod.id);
                    const isDisabled = !isSelected && group.maxChoices && currentSelected.length >= group.maxChoices && group.maxChoices !== 1;
                    const priceAdj = Number(mod.priceAdjustment || 0);

                    return (
                      <div 
                        key={mod.id} 
                        className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        onClick={() => !isDisabled && toggleSelection(group.id, mod.id, group.maxChoices)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isSelected} onCheckedChange={() => !isDisabled && toggleSelection(group.id, mod.id, group.maxChoices)} disabled={isDisabled} />
                          <span className={isSelected ? 'font-medium' : ''}>{mod.name}</span>
                        </div>
                        {priceAdj > 0 && (
                          <span className="text-sm text-muted-foreground">+{formatCurrency(priceAdj)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={!isValid} onClick={() => onConfirm(item, getSelectedModifierObjects())}>
             Add to Order
             <span className="ml-2 bg-primary-foreground/20 px-2 py-0.5 rounded text-xs">
                {formatCurrency(currentTotal)}
             </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
