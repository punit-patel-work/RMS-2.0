'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import {
  UserPlus,
  Shield,
  ChefHat,
  User,
  Crown,
  ToggleLeft,
  ToggleRight,
  Pencil,
} from 'lucide-react';
import { createUser, updateUser, toggleUserActive } from '@/server/actions/user.actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface UserData {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: { orders: number };
}

const roleConfig: Record<string, { label: string; icon: any; color: string }> = {
  OWNER: { label: 'Owner', icon: Crown, color: 'bg-amber-100 text-amber-700' },
  SUPERVISOR: { label: 'Supervisor', icon: Shield, color: 'bg-blue-100 text-blue-700' },
  FLOOR_STAFF: { label: 'Floor Staff', icon: User, color: 'bg-emerald-100 text-emerald-700' },
  KITCHEN_STAFF: { label: 'Kitchen Staff', icon: ChefHat, color: 'bg-orange-100 text-orange-700' },
};

export function UserManager({ users }: { users: UserData[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [form, setForm] = useState({ name: '', role: 'FLOOR_STAFF', pin: '' });

  const handleCreate = () => {
    if (!form.name.trim() || !form.pin.trim()) {
      toast.error('Name and PIN are required');
      return;
    }
    if (form.pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }
    startTransition(async () => {
      const result = await createUser(form.name, form.role as any, form.pin);
      if (result.success) {
        toast.success('User created');
        setShowCreate(false);
        setForm({ name: '', role: 'FLOOR_STAFF', pin: '' });
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleUpdate = () => {
    if (!editUser) return;
    startTransition(async () => {
      const data: any = { name: form.name, role: form.role };
      if (form.pin.trim()) data.pin = form.pin;
      const result = await updateUser(editUser.id, data);
      if (result.success) {
        toast.success('User updated');
        setEditUser(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleToggle = (userId: string) => {
    startTransition(async () => {
      const result = await toggleUserActive(userId);
      if (result.success) {
        toast.success('Status updated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          className="gap-2"
          onClick={() => {
            setForm({ name: '', role: 'FLOOR_STAFF', pin: '' });
            setShowCreate(true);
          }}
        >
          <UserPlus className="w-4 h-4" /> Add User
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((user) => {
          const rc = roleConfig[user.role] || roleConfig.FLOOR_STAFF;
          const RoleIcon = rc.icon;
          return (
            <Card key={user.id} className={!user.isActive ? 'opacity-50' : ''}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${rc.color}`}>
                      <RoleIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{user.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {rc.label}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditUser(user);
                        setForm({ name: user.name, role: user.role, pin: '' });
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggle(user.id)}
                      disabled={isPending}
                    >
                      {user.isActive ? (
                        <ToggleRight className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{user._count.orders} orders</span>
                  <span>{user.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog
        open={showCreate || editUser !== null}
        onOpenChange={(open) => {
          if (!open) { setShowCreate(false); setEditUser(null); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editUser ? 'Edit User' : 'Create User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="SUPERVISOR">Supervisor</SelectItem>
                  <SelectItem value="FLOOR_STAFF">Floor Staff</SelectItem>
                  <SelectItem value="KITCHEN_STAFF">Kitchen Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {editUser ? 'New PIN (leave blank to keep)' : 'PIN Code'}
              </Label>
              <Input
                type="password"
                value={form.pin}
                onChange={(e) => setForm({ ...form, pin: e.target.value })}
                placeholder="4—6 digits"
                maxLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditUser(null); }}>
              Cancel
            </Button>
            <Button onClick={editUser ? handleUpdate : handleCreate} disabled={isPending}>
              {isPending ? 'Saving...' : (editUser ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
