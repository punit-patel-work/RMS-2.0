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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'; // Add Tabs import
import { Plus, Power, Trash2, Tag, Percent, DollarSign, Pencil } from 'lucide-react';
import {
  createPromotion,
  updatePromotion,
  togglePromotion,
  deletePromotion,
} from '@/server/actions/promotion.actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Promotion {
  id: string;
  name: string;
  type: 'FIXED' | 'PERCENT' | 'COMBO';
  value: number;
  scope: 'ITEM' | 'CATEGORY';
  active: boolean;
  menuItem?: { id: string; name: string } | null;
  category?: { id: string; name: string };
  menuItemId?: string | null;
  categoryId?: string | null;
  startsAt?: Date | string | null;
  endsAt?: Date | string | null;
  rules?: {
      id: string;
      requiredQuantity: number;
      menuItemId?: string | null;
      categoryId?: string | null;
      isDiscounted: boolean;
      name?: string | null;
      menuItem?: { id: string; name: string } | null;
      category?: { id: string; name: string } | null;
  }[];
}

interface MenuItem {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

export function PromotionManager({
  promotions,
  menuItems,
  categories,
}: {
  promotions: Promotion[];
  menuItems: MenuItem[];
  categories: Category[];
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    type: 'PERCENT' as 'FIXED' | 'PERCENT' | 'COMBO',
    value: '',
    scope: 'ITEM' as 'ITEM' | 'CATEGORY',
    menuItemId: '',
    categoryId: '',
    startsAt: '',
    endsAt: '',
    rules: [] as {
        _id: string; // Client-side stable ID
        requiredQuantity: number;
        menuItemId: string;
        categoryId: string;
        isDiscounted: boolean;
        scope: 'ITEM' | 'CATEGORY';
    }[],
  });

  const handleSave = () => {
    startTransition(async () => {
      const data = {
        name: form.name,
        type: form.type,
        value: parseFloat(form.value),
        scope: form.scope,
        menuItemId: form.scope === 'ITEM' ? form.menuItemId : undefined,
        categoryId: form.scope === 'CATEGORY' ? form.categoryId : undefined,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
        rules: form.type === 'COMBO' ? form.rules.map(r => ({
            requiredQuantity: r.requiredQuantity,
            menuItemId: r.scope === 'ITEM' ? r.menuItemId : undefined,
            categoryId: r.scope === 'CATEGORY' ? r.categoryId : undefined,
            isDiscounted: r.isDiscounted,
            name: r.isDiscounted ? 'Reward' : 'Trigger'
        })) : undefined
      };

      const result = editingPromo 
        ? await updatePromotion(editingPromo.id, data)
        : await createPromotion(data);

      if (result.success) {
        toast.success(editingPromo ? 'Promotion updated' : 'Promotion created');
        setDialogOpen(false);
        setEditingPromo(null);
        resetForm();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const resetForm = () => {
      setForm({ 
          name: '', 
          type: 'PERCENT', 
          value: '', 
          scope: 'ITEM', 
          menuItemId: '', 
          categoryId: '', 
          startsAt: '', 
          endsAt: '',
          rules: [] 
      });
  }

  const openEdit = (promo: Promotion) => {
    setEditingPromo(promo);
    setForm({
      name: promo.name,
      type: promo.type,
      value: promo.value.toString(),
      scope: promo.scope,
      menuItemId: promo.menuItemId || (promo.menuItem?.id || ''),
      categoryId: promo.categoryId || (promo.category?.id || ''), 
      startsAt: promo.startsAt ? new Date(promo.startsAt).toISOString().slice(0, 16) : '',
      endsAt: promo.endsAt ? new Date(promo.endsAt).toISOString().slice(0, 16) : '',
      rules: promo.rules?.map(r => ({
          _id: r.id, // Use DB rule ID as key
          requiredQuantity: r.requiredQuantity,
          menuItemId: r.menuItemId || '',
          categoryId: r.categoryId || '',
          isDiscounted: r.isDiscounted,
          scope: r.categoryId ? 'CATEGORY' : 'ITEM'
      })) || []
    });
    setDialogOpen(true);
  };
  
  const openCreate = () => {
      setEditingPromo(null);
      resetForm();
      setDialogOpen(true);
  };

  const handleToggle = (id: string) => {
    startTransition(async () => {
      const result = await togglePromotion(id);
      if (result.success) router.refresh();
      else toast.error(result.error);
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deletePromotion(id);
      if (result.success) {
        toast.success('Promotion deleted');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const addRule = () => {
      setForm({
          ...form,
          rules: [...form.rules, { 
              _id: Math.random().toString(36).substr(2, 9), 
              requiredQuantity: 1, 
              menuItemId: '', 
              categoryId: '', 
              isDiscounted: false, 
              scope: 'ITEM' 
          }]
      });
  };

  const removeRule = (index: number) => {
      const newRules = [...form.rules];
      newRules.splice(index, 1);
      setForm({ ...form, rules: newRules });
  };

  const updateRule = (index: number, field: string, value: any) => {
      const newRules = form.rules.map((rule, i) => {
          if (i === index) {
              return { ...rule, [field]: value };
          }
          return rule;
      });
      setForm({ ...form, rules: newRules });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          New Promotion
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {promotions.map((promo) => (
          <Card
            key={promo.id}
            className={cn(!promo.active && 'opacity-50')}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold">{promo.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={promo.type === 'PERCENT' ? 'default' : 'secondary'}>
                      {promo.type === 'PERCENT' && (
                        <span className="flex items-center gap-1">
                          <Percent className="w-3 h-3" />
                          {promo.value}%
                        </span>
                      )}
                      {promo.type === 'FIXED' && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {promo.value}
                        </span>
                      )}
                      {promo.type === 'COMBO' && (
                        <span className="flex items-center gap-1">
                          Combo ${promo.value}
                        </span>
                      )}
                    </Badge>
                    {promo.type !== 'COMBO' && (
                        <Badge variant="outline">
                        {promo.scope === 'ITEM'
                            ? promo.menuItem?.name ?? 'Item'
                            : promo.category?.name ?? 'Category'}
                        </Badge>
                    )}
                  </div>
                  <Badge
                    variant={promo.active ? 'default' : 'destructive'}
                    className="mt-2"
                  >
                    {promo.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(promo)}
                    disabled={isPending}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleToggle(promo.id)}
                    disabled={isPending}
                  >
                    <Power className={cn('w-4 h-4', promo.active ? 'text-emerald-500' : 'text-destructive')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(promo.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {promotions.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">
            No promotions yet
          </p>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPromo ? 'Edit Promotion' : 'Create Promotion'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={form.type === 'COMBO' ? "Meal Deal (Burger + Fries)" : "Happy Hour 15%"}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT">Percentage (%)</SelectItem>
                    <SelectItem value="FIXED">Fixed Discount ($)</SelectItem>
                    <SelectItem value="COMBO">Meal Combo (Bundle)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.type === 'COMBO' ? 'Bundle Price' : 'Value'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder={form.type === 'PERCENT' ? '15' : '2.00'}
                />
              </div>
            </div>

            {form.type === 'COMBO' ? (
                <div className="space-y-4 border rounded-md p-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                        <Label className="font-semibold">Combo Rules</Label>
                        <Button size="sm" variant="outline" onClick={addRule}>
                            <Plus className="w-3 h-3 mr-1" /> Add Rule
                        </Button>
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
                    {form.rules.map((rule, idx) => (
                        <div key={rule._id} className="grid grid-cols-12 gap-2 items-center border-b pb-2 last:border-0">
                            <div className="col-span-2">
                                <Label className="text-xs">Qty</Label>
                                <Input 
                                    type="number" 
                                    className="h-8" 
                                    value={rule.requiredQuantity ?? ''} 
                                    onChange={(e) => updateRule(idx, 'requiredQuantity', parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="col-span-3">
                                <Label className="text-xs">Type</Label>
                                <Select value={rule.scope} onValueChange={(v) => updateRule(idx, 'scope', v)}>
                                    <SelectTrigger className="h-8">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ITEM">Item</SelectItem>
                                        <SelectItem value="CATEGORY">Category</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-4">
                                <Label className="text-xs">Target</Label>
                                {rule.scope === 'ITEM' ? (
                                    <Select value={rule.menuItemId || ''} onValueChange={(v) => updateRule(idx, 'menuItemId', v)}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Item" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {menuItems.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Select value={rule.categoryId || ''} onValueChange={(v) => updateRule(idx, 'categoryId', v)}>
                                        <SelectTrigger className="h-8">
                                            <SelectValue placeholder="Cat" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                            <div className="col-span-2 flex flex-col items-center justify-center">
                                <Label className="text-xs mb-1">Reward?</Label>
                                <input 
                                    type="checkbox" 
                                    className="w-4 h-4"
                                    checked={rule.isDiscounted}
                                    onChange={(e) => updateRule(idx, 'isDiscounted', e.target.checked)}
                                />
                            </div>
                            <div className="col-span-1 flex justify-end">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRule(idx)}>
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    </div>
                    {form.rules.length === 0 && <p className="text-sm text-muted-foreground italic">Add rules to define the combo (e.g. Buy 1 Burger, Get 1 Coke for $X)</p>}

                    <div className="bg-blue-500/10 p-2 rounded text-xs text-blue-600">
                        <p><strong>Tip:</strong> Checked "Reward" rules share the Bundle Price. Unchecked "Trigger" rules stay full price.</p>
                        <p>Example: Buy 1 Burger (Trigger), Get 1 Fries (Reward), 1 Coke (Reward) for $4.</p>
                    </div>
                </div>
            ) : (
                <>
                {/* Scope Selection via Tabs */}
                <Tabs 
                    value={form.scope} 
                    onValueChange={(v) => setForm({ ...form, scope: v as 'ITEM' | 'CATEGORY' })}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="ITEM">Single Item</TabsTrigger>
                        <TabsTrigger value="CATEGORY">Entire Category</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="ITEM" className="space-y-2 mt-4">
                        <Label>Select Item</Label>
                        <Select
                        value={form.menuItemId}
                        onValueChange={(v) => setForm({ ...form, menuItemId: v })}
                        >
                        <SelectTrigger>
                            <SelectValue placeholder="Select item" />
                        </SelectTrigger>
                        <SelectContent>
                            {menuItems.map((i) => (
                            <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </TabsContent>
                    
                    <TabsContent value="CATEGORY" className="space-y-2 mt-4">
                        <Label>Select Category</Label>
                        <Select
                        value={form.categoryId}
                        onValueChange={(v) => setForm({ ...form, categoryId: v })}
                        >
                        <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                            {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    </TabsContent>
                </Tabs>
                </>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                        type="datetime-local"
                        value={form.startsAt}
                        onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input
                        type="datetime-local"
                        value={form.endsAt}
                        onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                    />
                </div>
            </div>

            {/* Live Summary */}
            <div className="bg-muted p-3 rounded-lg text-sm text-muted-foreground border border-border">
                <span className="font-semibold text-foreground">Summary: </span>
                {form.type === 'COMBO' ? (
                     <span>
                        {form.name ? `"${form.name}"` : 'This Combo'} bundle price is <span className="font-bold text-primary">${form.value || 0}</span>.
                        Rules: {form.rules.length > 0 ? form.rules.map((r, i) => (
                            <span key={i} className="block pl-2">
                                - {r.requiredQuantity}x {r.scope} {r.scope === 'ITEM' ? (menuItems.find(x => x.id === r.menuItemId)?.name || '?') : (categories.find(c => c.id === r.categoryId)?.name || '?')}
                                {r.isDiscounted ? ' (REWARD)' : ' (TRIGGER)'}
                            </span>
                        )) : ' (No rules)'}
                     </span>
                ) : (
                <span>
                    {form.name ? `"${form.name}" gives ` : 'This promotion gives '}
                    <span className="font-bold text-primary">
                        {form.type === 'PERCENT' ? `${form.value || 0}% OFF` : `$${form.value || 0} OFF`}
                    </span>
                    {' on '}
                    <span className="font-medium text-foreground">
                        {form.scope === 'ITEM' 
                            ? (menuItems.find(i => i.id === form.menuItemId)?.name || 'selected item')
                            : (categories.find(c => c.id === form.categoryId)?.name || 'entire category')
                        }
                    </span>.
                </span>
                )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving...' : (editingPromo ? 'Save' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
