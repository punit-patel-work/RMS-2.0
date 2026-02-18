'use client';

import { useState, useTransition, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Utensils, Delete } from 'lucide-react';

const PIN_LENGTH = 4;

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDigit = (digit: string) => {
    if (pin.length < PIN_LENGTH) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const doSubmit = (currentPin: string) => {
    startTransition(async () => {
      const result = await signIn('credentials', {
        pinCode: currentPin,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Invalid PIN. Please try again.');
        setPin('');
      } else {
        toast.success('Welcome!');
        router.push('/pos');
        router.refresh();
      }
    });
  };

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !isPending) {
      doSubmit(pin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm mx-4 border-border/50">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Utensils className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            RMS
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your 4-digit staff PIN
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PIN Display — 4 dots */}
          <div className="flex justify-center gap-3">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                  i < pin.length
                    ? 'bg-primary border-primary scale-110'
                    : 'border-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {digits.map((digit, i) => {
              if (digit === '' && i === 9) {
                return <div key={`empty-${i}`} />;
              }
              if (digit === '' && i === 11) {
                return (
                  <Button
                    key="delete"
                    variant="outline"
                    size="lg"
                    className="h-16 text-lg"
                    onClick={handleDelete}
                    disabled={pin.length === 0 || isPending}
                  >
                    <Delete className="w-5 h-5" />
                  </Button>
                );
              }
              return (
                <Button
                  key={digit}
                  variant="outline"
                  size="lg"
                  className="h-16 text-xl font-semibold hover:bg-primary/10 active:scale-95 transition-transform"
                  onClick={() => handleDigit(digit)}
                  disabled={isPending}
                >
                  {digit}
                </Button>
              );
            })}
          </div>

          {/* Loading indicator */}
          {isPending && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
              <span>Signing in...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
