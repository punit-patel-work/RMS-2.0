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
import { Plus, Eye, EyeOff, Trash2, Pencil, Search } from 'lucide-react';
import { createCategory, updateCategory, deleteMenuItem, toggleMenuItemAvailability, updateMenuItem, createMenuItem } from '@/server/actions/menu.actions';
import { ModifierManager } from '@/components/admin/modifier-manager';
import { formatCurrency } from '@/lib/pricing';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  basePrice: number;
  isAvailable: boolean;
  trackStock: boolean;
  stockQuantity: number;
  imageUrl?: string | null;
  category: { id: string; name: string };
  modifierGroups?: any[];
}

interface Category {
  id: string;
  name: string;
  stationId?: string | null;
}

export function MenuManager({
  items,
  categories,
  stations,
}: {
  items: MenuItem[];
  categories: Category[];
  stations: { id: string; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState('new');
  const [newCatName, setNewCatName] = useState('');
  const [newCatStation, setNewCatStation] = useState<string>('');
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const router = useRouter();

  // Form state
  const [form, setForm] = useState({
    name: '',
    description: '',
    basePrice: '',
    categoryId: '',
    imageUrl: '',
    isAvailable: true,
    trackStock: false,
    stockQuantity: '0',
  });

  const filteredItems = items.filter(i => {
    if (filter !== 'all' && i.category.id !== filter) return false;
    if (searchQuery.trim() && !i.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    return true;
  });

  const handleSave = () => {
    startTransition(async () => {
      const data = {
        name: form.name,
        description: form.description || undefined,
        basePrice: parseFloat(form.basePrice),
        categoryId: form.categoryId,
        imageUrl: form.imageUrl || undefined,
        isAvailable: form.isAvailable,
        trackStock: form.trackStock,
        stockQuantity: parseInt(form.stockQuantity) || 0,
      };

      const result = editingItem 
        ? await updateMenuItem(editingItem.id, data)
        : await createMenuItem(data);

      if (result.success) {
        toast.success(editingItem ? 'Menu item updated' : 'Menu item created');
        setDialogOpen(false);
        setEditingItem(null);
        setForm({ name: '', description: '', basePrice: '', categoryId: '', imageUrl: '', isAvailable: true, trackStock: false, stockQuantity: '0' });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const openEdit = (item: MenuItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      description: item.description || '',
      basePrice: item.basePrice.toString(),
      categoryId: item.category.id,
      imageUrl: item.imageUrl || '',
      isAvailable: item.isAvailable,
      trackStock: item.trackStock,
      stockQuantity: item.stockQuantity.toString(),
    });
    setDialogOpen(true);
  };
  
  const openCreate = () => {
      setEditingItem(null);
      setForm({ name: '', description: '', basePrice: '', categoryId: '', imageUrl: '', isAvailable: true, trackStock: false, stockQuantity: '0' });
      setDialogOpen(true);
  };

  const handleToggle = (id: string) => {
    startTransition(async () => {
      const result = await toggleMenuItemAvailability(id);
      if (result.success) {
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteMenuItem(id);
      if (result.success) {
        toast.success('Item deleted');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSaveCategory = () => {
    startTransition(async () => {
      let result;
      if (editingCategoryId === 'new') {
        result = await createCategory(newCatName, newCatStation !== 'none' ? newCatStation : undefined);
      } else {
        result = await updateCategory(editingCategoryId, newCatName, newCatStation !== 'none' ? newCatStation : undefined);
      }
      if (result.success) {
        toast.success(editingCategoryId === 'new' ? 'Category created' : 'Category updated');
        setCatDialogOpen(false);
        setNewCatName('');
        setNewCatStation('');
        setEditingCategoryId('new');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search items..." 
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCatDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Category
        </Button>

        <Button
          size="sm"
          onClick={openCreate}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Menu Item
        </Button>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredItems.map((item) => (
          <Card
            key={item.id}
            className={cn(
              'transition-all duration-200 overflow-hidden',
              !item.isAvailable && 'opacity-50'
            )}
          >
            {item.imageUrl && (
              <div className="relative h-32 w-full">
                <img 
                  src={item.imageUrl} 
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{item.name}</h3>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  )}
                  <p className="text-lg font-bold mt-1 mb-1">
                    {formatCurrency(item.basePrice)}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="secondary">
                      {item.category.name}
                    </Badge>
                    {item.trackStock && (
                      <Badge variant={item.stockQuantity > 0 ? 'outline' : 'destructive'}>
                        {item.stockQuantity} in stock
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <ModifierManager 
                    menuItemId={item.id} 
                    itemName={item.name} 
                    initialGroups={item.modifierGroups || []} 
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(item)}
                    disabled={isPending}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleToggle(item.id)}
                    disabled={isPending}
                    title={item.isAvailable ? '86 this item' : 'Bring back'}
                  >
                    {item.isAvailable ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-destructive" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDelete(item.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Grilled Salmon"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Atlantic salmon, lemon herb"
              />
            </div>
            <div className="space-y-2">
                <Label>Image URL (Optional)</Label>
                <Input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                  placeholder="28.99"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(v) => setForm({ ...form, categoryId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-10 border rounded-md p-4">
              <div className="flex items-center space-x-2 flex-1">
                <input
                  type="checkbox"
                  id="trackStock"
                  checked={form.trackStock}
                  onChange={(e) => setForm({ ...form, trackStock: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="trackStock">Track Inventory Stock</Label>
              </div>
              <div className={cn("space-y-2 flex-1", !form.trackStock && "opacity-50 pointer-events-none")}>
                <Label>Quantity strictly available</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.stockQuantity}
                  onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                  placeholder="50"
                  disabled={!form.trackStock}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving...' : (editingItem ? 'Save Changes' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={(open) => {
        setCatDialogOpen(open);
        if (!open) { setEditingCategoryId('new'); setNewCatName(''); setNewCatStation(''); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Select Category to Edit</Label>
              <Select 
                value={editingCategoryId}
                onValueChange={(id) => {
                  setEditingCategoryId(id);
                  if (id === 'new') {
                    setNewCatName('');
                    setNewCatStation('none');
                  } else {
                    const cat = categories.find(c => c.id === id);
                    if (cat) {
                       setNewCatName(cat.name);
                       setNewCatStation(cat.stationId || 'none');
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new" className="font-bold">-- Create New Category --</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Desserts"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Station Routing (Optional)</Label>
              <Select
                value={newCatStation || 'none'}
                onValueChange={setNewCatStation}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select station..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (No Routing)</SelectItem>
                  {stations.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCategory} disabled={isPending || !newCatName.trim()}>
              {isPending ? 'Saving...' : 'Save Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
