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
import { Plus, Eye, EyeOff, Trash2, Pencil } from 'lucide-react';
import {
  createMenuItem,
  updateMenuItem,
  toggleMenuItemAvailability,
  deleteMenuItem,
  createCategory,
} from '@/server/actions/menu.actions';
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
  imageUrl?: string | null;
  category: { id: string; name: string };
}

interface Category {
  id: string;
  name: string;
}

export function MenuManager({
  items,
  categories,
}: {
  items: MenuItem[];
  categories: Category[];
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [filter, setFilter] = useState('all');
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
  });

  const filteredItems =
    filter === 'all'
      ? items
      : items.filter((i) => i.category.id === filter);

  const handleSave = () => {
    startTransition(async () => {
      const data = {
        name: form.name,
        description: form.description || undefined,
        basePrice: parseFloat(form.basePrice),
        categoryId: form.categoryId,
        imageUrl: form.imageUrl || undefined,
        isAvailable: form.isAvailable,
      };

      const result = editingItem 
        ? await updateMenuItem(editingItem.id, data)
        : await createMenuItem(data);

      if (result.success) {
        toast.success(editingItem ? 'Menu item updated' : 'Menu item created');
        setDialogOpen(false);
        setEditingItem(null);
        setForm({ name: '', description: '', basePrice: '', categoryId: '', imageUrl: '', isAvailable: true });
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
    });
    setDialogOpen(true);
  };
  
  const openCreate = () => {
      setEditingItem(null);
      setForm({ name: '', description: '', basePrice: '', categoryId: '', imageUrl: '', isAvailable: true });
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

  const handleCreateCategory = () => {
    startTransition(async () => {
      const result = await createCategory(newCatName);
      if (result.success) {
        toast.success('Category created');
        setCatDialogOpen(false);
        setNewCatName('');
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
                  <p className="text-lg font-bold mt-1">
                    {formatCurrency(item.basePrice)}
                  </p>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {item.category.name}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
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
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving...' : (editingItem ? 'Save Changes' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Desserts"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreateCategory} disabled={isPending}>
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
