'use client';

import { useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getSiteSettings, updateSiteSetting } from '@/server/actions/settings.actions';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

export default function SettingsPage() {
  const [prepBuffer, setPrepBuffer] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function loadSettings() {
      const settings = await getSiteSettings();
      setPrepBuffer(settings['KITCHEN_PREP_BUFFER_MINUTES'] || '30'); // Default to 30
      setIsLoading(false);
    }
    loadSettings();
  }, []);

  const handleSave = () => {
    const minutes = parseInt(prepBuffer);
    if (isNaN(minutes) || minutes < 0) {
      toast.error('Please enter a valid number of minutes');
      return;
    }

    startTransition(async () => {
      const result = await updateSiteSetting('KITCHEN_PREP_BUFFER_MINUTES', prepBuffer);
      if (result.success) {
        toast.success('Settings updated');
      } else {
        toast.error('Failed to update settings');
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Site Settings</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Kitchen Display System (KDS)</CardTitle>
            <CardDescription>
              Configure how orders appear in the kitchen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prep-buffer">Prep Time Buffer (Minutes)</Label>
              <div className="flex gap-4">
                <Input
                  id="prep-buffer"
                  type="number"
                  min="0"
                  value={prepBuffer}
                  onChange={(e) => setPrepBuffer(e.target.value)}
                  className="max-w-[200px]"
                />
                <Button disabled={isPending} onClick={handleSave}>
                  {isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Scheduled orders will appear in the kitchen <strong>{prepBuffer} minutes</strong> before their scheduled time.
                ASAP orders always appear immediately.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
