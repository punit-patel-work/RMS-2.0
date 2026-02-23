'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

interface MockCampaignProps {
  activeCount: number;
  atRiskCount: number;
}

export function MockCampaignCreator({ activeCount, atRiskCount }: MockCampaignProps) {
  const [segment, setSegment] = useState<'ACTIVE' | 'AT_RISK'>('ACTIVE');
  const [method, setMethod] = useState<'SMS' | 'EMAIL'>('SMS');
  const [message, setMessage] = useState('We miss you! Come back this week for a free appetizer on us. Show this text to redeem.');
  const [isSending, setIsSending] = useState(false);

  const audienceSize = segment === 'ACTIVE' ? activeCount : atRiskCount;

  const handleSend = () => {
    if (!message.trim()) {
      toast.error('Campaign message cannot be empty.');
      return;
    }
    if (audienceSize === 0) {
      toast.error('Selected segment has no customers.');
      return;
    }

    setIsSending(true);
    
    // Simulate network delay for sending blast
    setTimeout(() => {
      toast.success(`Campaign successfully sent to ${audienceSize} customers via ${method}!`);
      setIsSending(false);
      setMessage('');
    }, 1500);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Campaign Creator</CardTitle>
        <CardDescription>Draft and send targeted promotions to your loyalty segments.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 flex-1">
        <div className="space-y-3">
          <Label className="font-semibold text-sm">1. Select Audience Segment</Label>
          <div className="grid grid-cols-2 gap-4">
             <button
                type="button"
                className={`py-3 px-4 rounded-lg flex flex-col items-start gap-1 border-2 transition-all ${
                  segment === 'ACTIVE' 
                    ? 'border-primary bg-primary/5 shadow-sm' 
                    : 'border-border bg-card hover:bg-muted'
                }`}
                onClick={() => setSegment('ACTIVE')}
             >
                <span className="font-semibold text-sm">Active Customers</span>
                <span className="text-xs text-muted-foreground">{activeCount} recipients</span>
             </button>
             <button
                type="button"
                className={`py-3 px-4 rounded-lg flex flex-col items-start gap-1 border-2 transition-all ${
                  segment === 'AT_RISK' 
                    ? 'border-primary bg-primary/5 shadow-sm' 
                    : 'border-border bg-card hover:bg-muted'
                }`}
                onClick={() => setSegment('AT_RISK')}
             >
                <span className="font-semibold text-sm">At-Risk Customers</span>
                <span className="text-xs text-muted-foreground">{atRiskCount} recipients</span>
             </button>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="font-semibold text-sm">2. Delivery Method</Label>
          <div className="grid grid-cols-2 gap-4">
             <button
                type="button"
                className={`py-2 px-4 rounded-lg flex items-center gap-2 border-2 transition-all ${
                  method === 'SMS' 
                    ? 'border-primary bg-primary/5 shadow-sm text-primary' 
                    : 'border-border bg-card hover:bg-muted'
                }`}
                onClick={() => setMethod('SMS')}
             >
                <MessageSquare className="w-4 h-4" />
                <span className="font-semibold text-sm">SMS Text</span>
             </button>
             <button
                type="button"
                className={`py-2 px-4 rounded-lg flex items-center gap-2 border-2 transition-all ${
                  method === 'EMAIL' 
                    ? 'border-primary bg-primary/5 shadow-sm text-primary' 
                    : 'border-border bg-card hover:bg-muted'
                }`}
                onClick={() => setMethod('EMAIL')}
             >
                <Mail className="w-4 h-4" />
                <span className="font-semibold text-sm">Email</span>
             </button>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="font-semibold text-sm">3. Message Content</Label>
          <Textarea 
             className="min-h-[120px] resize-none" 
             placeholder="Draft your promotional message here..."
             value={message}
             onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-xs text-muted-foreground text-right">
             {message.length} characters
          </p>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-6">
        <Button 
          className="w-full gap-2 text-base h-12" 
          disabled={isSending || audienceSize === 0} 
          onClick={handleSend}
        >
           {isSending ? (
             <span className="animate-pulse">Sending Campaign...</span>
           ) : (
             <>
               <Send className="w-4 h-4" />
               Send to {audienceSize} {audienceSize === 1 ? 'Customer' : 'Customers'}
             </>
           )}
        </Button>
      </CardFooter>
    </Card>
  );
}
