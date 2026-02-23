"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Clock,
  Delete,
  User,
  ArrowLeft,
  CheckCircle2,
  LogOut,
  History,
  Calendar,
} from "lucide-react";
import {
  clockIn,
  clockOut,
  getStaffDashboard,
} from "@/server/actions/attendance.actions";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function TimeclockPage() {
  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [isPending, startTransition] = useTransition();
  const [dashboardData, setDashboardData] = useState<any>(null);

  const handleLogin = async (currentPin: string) => {
    if (!employeeId.trim()) {
      toast.error("Please enter your Employee ID first");
      setPin("");
      return;
    }

    startTransition(async () => {
      const result = await getStaffDashboard(employeeId.trim(), currentPin);

      if (!result.success) {
        toast.error(result.error || "Invalid credentials");
        setPin("");
        return;
      }

      setDashboardData(result);
    });
  };

  const handleAction = async (type: "in" | "out") => {
    startTransition(async () => {
      const result =
        type === "in"
          ? await clockIn(employeeId.trim(), pin)
          : await clockOut(employeeId.trim(), pin);

      if (result.success) {
        toast.success(result.message);
        // Refresh dashboard
        const freshData = await getStaffDashboard(employeeId.trim(), pin);
        if (freshData.success) {
          setDashboardData(freshData);
        }
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleLogout = () => {
    setDashboardData(null);
    setEmployeeId("");
    setPin("");
  };

  if (dashboardData) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
        <Card className="w-full max-w-md border-border shadow-xl">
          <CardHeader className="text-center space-y-2 pb-6 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-4 text-muted-foreground"
              onClick={handleLogout}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {dashboardData.userName}
            </CardTitle>
            <div className="flex justify-center items-center gap-2 text-sm font-medium">
              {dashboardData.isClockedIn ? (
                <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Clocked In Since{" "}
                  {format(new Date(dashboardData.clockInTime), "h:mm a")}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Currently Clocked Out
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-8">
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant={dashboardData.isClockedIn ? "outline" : "default"}
                className={`h-20 flex flex-col items-center justify-center gap-2 text-lg shadow-sm ${!dashboardData.isClockedIn ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                disabled={isPending || dashboardData.isClockedIn}
                onClick={() => handleAction("in")}
              >
                <CheckCircle2 className="w-6 h-6" />
                Clock In
              </Button>
              <Button
                variant={!dashboardData.isClockedIn ? "outline" : "default"}
                className={`h-20 flex flex-col items-center justify-center gap-2 text-lg shadow-sm ${dashboardData.isClockedIn ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}`}
                disabled={isPending || !dashboardData.isClockedIn}
                onClick={() => handleAction("out")}
              >
                <Clock className="w-6 h-6" />
                Clock Out
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-900 border border-border p-4 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Today
                  </p>
                  <p className="text-xl font-bold">
                    {dashboardData.todayHours}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      hrs
                    </span>
                  </p>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 border border-border p-4 rounded-xl flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    This Week
                  </p>
                  <p className="text-xl font-bold">
                    {dashboardData.weekHours}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      hrs
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Detailed Hours / Recent Punches */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4" /> This Week's Shifts
                </span>
                <span>{dashboardData.weeklyRecords?.length || 0} Punches</span>
              </div>
              <ScrollArea className="h-48 border border-border rounded-xl bg-slate-50/30 dark:bg-slate-900/30">
                <div className="divide-y divide-border">
                  {dashboardData.weeklyRecords &&
                  dashboardData.weeklyRecords.length > 0 ? (
                    dashboardData.weeklyRecords.map((r: any) => {
                      const inTimeStr = format(new Date(r.clockIn), "h:mm a");
                      const outTimeStr = r.clockOut
                        ? format(new Date(r.clockOut), "h:mm a")
                        : "Now";
                      const dateStr = format(new Date(r.clockIn), "EEE, MMM d");

                      let durationHrs = "0.0";
                      if (r.clockOut) {
                        const mins = Math.max(
                          0,
                          Math.round(
                            (new Date(r.clockOut).getTime() -
                              new Date(r.clockIn).getTime()) /
                              60000,
                          ),
                        );
                        durationHrs = (mins / 60).toFixed(1);
                      } else {
                        const mins = Math.max(
                          0,
                          Math.round(
                            (new Date().getTime() -
                              new Date(r.clockIn).getTime()) /
                              60000,
                          ),
                        );
                        durationHrs = (mins / 60).toFixed(1);
                      }

                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">{dateStr}</p>
                            <p className="text-xs text-muted-foreground">
                              {inTimeStr} - {outTimeStr}
                            </p>
                          </div>
                          <div className="font-semibold">{durationHrs} hrs</div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No shifts logged this week
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <Card className="w-full max-w-sm border-border shadow-xl">
        <CardHeader className="text-center space-y-4 pb-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Clock className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Time & Attendance
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter your Employee ID and Password to access Staff Dashboard
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
              type="text"
              name="employeeId-disable-autofill"
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
                  handleLogin(pin);
                }
              }}
            />
          </div>

          <Button
            className="w-full h-12 text-lg"
            onClick={() => handleLogin(pin)}
            disabled={isPending || !employeeId || !pin}
          >
            {isPending ? "Verifying..." : "Login"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
