'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getSiteSettings, updateSiteSetting } from '@/server/actions/settings.actions';
import { toast } from 'sonner';
import { Loader2, Save, Store, ChefHat, Receipt, Coins } from 'lucide-react';

interface SettingsState {
  RESTAURANT_NAME: string;
  RESTAURANT_ADDRESS: string;
  RESTAURANT_PHONE: string;
  TAX_RATE: string;
  KITCHEN_PREP_BUFFER_MINUTES: string;
  LOYALTY_POINTS_RATE: string;
  CURRENCY_SYMBOL: string;
}

const defaultSettings: SettingsState = {
  RESTAURANT_NAME: 'My Restaurant',
  RESTAURANT_ADDRESS: '',
  RESTAURANT_PHONE: '',
  TAX_RATE: '7',
  KITCHEN_PREP_BUFFER_MINUTES: '30',
  LOYALTY_POINTS_RATE: '0.10',
  CURRENCY_SYMBOL: '$',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadSettings() {
      const data = await getSiteSettings();
      setSettings((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(data).filter(([key]) => key in prev)
        ),
      }));
      setIsLoading(false);
    }
    loadSettings();
  }, []);

  const updateField = (key: keyof SettingsState, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setDirtyKeys((prev) => new Set(prev).add(key));
  };

  const handleSaveAll = () => {
    if (dirtyKeys.size === 0) {
      toast.info('No changes to save');
      return;
    }

    startTransition(async () => {
      const keys = Array.from(dirtyKeys);
      const results = await Promise.all(
        keys.map((key) =>
          updateSiteSetting(key, settings[key as keyof SettingsState])
        )
      );

      const failed = results.filter((r) => !r.success);
      if (failed.length === 0) {
        toast.success(`${keys.length} setting${keys.length > 1 ? 's' : ''} updated`);
        setDirtyKeys(new Set());
      } else {
        toast.error(`Failed to update ${failed.length} setting(s)`);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Site Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your restaurant&apos;s global settings.
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={isPending || dirtyKeys.size === 0}>
          {isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save All Changes
          {dirtyKeys.size > 0 && (
            <span className="ml-1.5 bg-primary-foreground/20 text-primary-foreground px-1.5 py-0.5 rounded text-[10px]">
              {dirtyKeys.size}
            </span>
          )}
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Restaurant Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5 text-muted-foreground" />
              Restaurant Information
            </CardTitle>
            <CardDescription>
              This information appears on receipts and printed bills.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="restaurant-name">Restaurant Name</Label>
                <Input
                  id="restaurant-name"
                  value={settings.RESTAURANT_NAME}
                  onChange={(e) => updateField('RESTAURANT_NAME', e.target.value)}
                  placeholder="My Restaurant"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant-phone">Phone</Label>
                <Input
                  id="restaurant-phone"
                  value={settings.RESTAURANT_PHONE}
                  onChange={(e) => updateField('RESTAURANT_PHONE', e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="restaurant-address">Address</Label>
              <Input
                id="restaurant-address"
                value={settings.RESTAURANT_ADDRESS}
                onChange={(e) => updateField('RESTAURANT_ADDRESS', e.target.value)}
                placeholder="123 Main St, City, State 12345"
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing & Tax */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-muted-foreground" />
              Pricing & Tax
            </CardTitle>
            <CardDescription>
              Configure tax rates and currency.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.TAX_RATE}
                  onChange={(e) => updateField('TAX_RATE', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Applied to all orders. Currently {settings.TAX_RATE}%.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency-symbol">Currency Symbol</Label>
                <Input
                  id="currency-symbol"
                  value={settings.CURRENCY_SYMBOL}
                  onChange={(e) => updateField('CURRENCY_SYMBOL', e.target.value)}
                  className="max-w-[100px]"
                  maxLength={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KDS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-muted-foreground" />
              Kitchen Display System (KDS)
            </CardTitle>
            <CardDescription>
              Configure how orders appear in the kitchen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prep-buffer">Prep Time Buffer (Minutes)</Label>
              <Input
                id="prep-buffer"
                type="number"
                min="0"
                value={settings.KITCHEN_PREP_BUFFER_MINUTES}
                onChange={(e) => updateField('KITCHEN_PREP_BUFFER_MINUTES', e.target.value)}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Scheduled orders appear in the kitchen <strong>{settings.KITCHEN_PREP_BUFFER_MINUTES} minutes</strong> before their scheduled time.
                ASAP orders always appear immediately.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Loyalty */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-muted-foreground" />
              Loyalty Program
            </CardTitle>
            <CardDescription>
              Configure points earned per dollar spent.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loyalty-rate">Point Value ({settings.CURRENCY_SYMBOL})</Label>
              <Input
                id="loyalty-rate"
                type="number"
                step="0.01"
                min="0"
                value={settings.LOYALTY_POINTS_RATE}
                onChange={(e) => updateField('LOYALTY_POINTS_RATE', e.target.value)}
                className="max-w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                Each loyalty point is worth <strong>{settings.CURRENCY_SYMBOL}{settings.LOYALTY_POINTS_RATE}</strong> toward a discount.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
