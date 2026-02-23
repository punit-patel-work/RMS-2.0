"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Utensils } from "lucide-react";

export default function LoginPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const doSubmit = (currentPin: string) => {
    if (!employeeId.trim()) {
      toast.error("Please enter your Employee ID first");
      setPin("");
      return;
    }

    startTransition(async () => {
      const result = await signIn("credentials", {
        employeeId: employeeId.trim(),
        pinCode: currentPin,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid Employee ID or PIN. Please try again.");
        setPin("");
      } else {
        toast.success("Welcome!");
        router.push("/pos");
        router.refresh();
      }
    });
  };

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
            Enter your Employee ID and Password
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Employee ID Input */}
          <div className="space-y-2">
            <Label
              htmlFor="employeeId"
              className="text-muted-foreground text-xs uppercase font-bold"
            >
              Employee ID
            </Label>
            <Input
              id="employeeId"
              name="employeeId-disable-autofill"
              type="text"
              autoComplete="new-password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="e.g. 101"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg h-12"
            />
          </div>

          {/* Password Input */}
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-muted-foreground text-xs uppercase font-bold"
            >
              Password
            </Label>
            <Input
              id="password"
              name="password-disable-autofill"
              type="password"
              autoComplete="new-password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Enter password"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg h-12"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  doSubmit(pin);
                }
              }}
            />
          </div>

          <Button
            className="w-full h-12 text-lg"
            onClick={() => doSubmit(pin)}
            disabled={isPending || !employeeId || !pin}
          >
            {isPending ? "Signing in..." : "Login"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
