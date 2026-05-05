'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format, addDays, startOfWeek, subWeeks, addWeeks, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWeeklySchedules, getStaffList, createShift, deleteShift, copyPreviousWeekSchedule } from '@/server/actions/schedule.actions';
import { toast } from 'sonner';

export function ScheduleView({ userRole, currentUserId }: { userRole: string, currentUserId: string }) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    // F-M8: locale-aware week start. Intl.Locale.weekInfo returns
    // `firstDay` 1..7 (Mon..Sun ISO numbering); JS Date.getDay() returns
    // 0..6 (Sun..Sat). Convert and fall back to Sunday on older runtimes.
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    let firstDayJs = 0; // Sunday default
    try {
      const locale = new Intl.Locale(navigator.language);
      // Older lib types may not include weekInfo — read defensively.
      const weekInfo = (locale as unknown as { weekInfo?: { firstDay: number } }).weekInfo
        ?? (locale as unknown as { getWeekInfo?: () => { firstDay: number } }).getWeekInfo?.();
      if (weekInfo?.firstDay) {
        firstDayJs = weekInfo.firstDay === 7 ? 0 : weekInfo.firstDay; // ISO 7 = Sun
      }
    } catch {
      // ignore — fall through to Sunday
    }
    const offset = (d.getDay() - firstDayJs + 7) % 7;
    d.setDate(d.getDate() - offset);
    return d;
  });

  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Fetch Schedules
  const fetcher = async () => {
    const res = await getWeeklySchedules(currentWeekStart, weekEnd);
    return res.success ? res.data : [];
  };
  const { data: schedules, mutate } = useSWR(`schedules-${currentWeekStart.toISOString()}`, fetcher);

  // Fetch Staff
  const staffFetcher = async () => {
    const res = await getStaffList();
    return res.success ? res.data : [];
  };
  const { data: staff } = useSWR(userRole === 'OWNER' || userRole === 'SUPERVISOR' ? 'staff-list' : null, staffFetcher);

  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    userId: '',
    date: '', // YYYY-MM-DD
    startTime: '09:00', // HH:MM
    endTime: '17:00', // HH:MM
    notes: '',
    isOnLeave: false,
  });

  const canEdit = userRole === 'OWNER' || userRole === 'SUPERVISOR';

  const handlePreviousWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };

  const handleCreateShift = async () => {
    if (!formData.userId || !formData.date || !formData.startTime || !formData.endTime) {
      toast.error('Please fill all required fields');
      return;
    }

    const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
    const endDateTime = new Date(`${formData.date}T${formData.endTime}:00`);

    if (endDateTime <= startDateTime) {
      toast.error('End time must be after start time');
      return;
    }

    const res = await createShift({
      userId: formData.userId,
      startTime: startDateTime,
      endTime: endDateTime,
      notes: formData.notes,
    });

    if (res.success) {
      toast.success('Shift created');
      setIsDialogOpen(false);
      mutate();
    } else {
      toast.error(res.error);
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Are you sure you want to delete this shift?')) return;
    const res = await deleteShift(id);
    if (res.success) {
      toast.success('Shift deleted');
      mutate();
    } else {
      toast.error(res.error);
    }
  };

  const handleCopyLastWeek = async () => {
    if (!confirm('This will copy all shifts from the previous week to the current week. Do you want to proceed?')) return;
    
    const res = await copyPreviousWeekSchedule(currentWeekStart);
    if (res.success) {
      toast.success(res.message);
      mutate();
    } else {
      toast.error(res.error);
    }
  };

  // Group schedules by Day (0-6)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const groupedSchedules = days.map((dayName, idx) => {
    const rowDate = new Date(currentWeekStart);
    rowDate.setDate(rowDate.getDate() + idx);
    
    // Filter shifts that fall on this specific day
    const shiftsForDay = (schedules || []).filter(s => {
      const shiftDate = new Date(s.startTime);
      return shiftDate.getDate() === rowDate.getDate() && shiftDate.getMonth() === rowDate.getMonth();
    });

    return {
      dayName,
      date: rowDate,
      shifts: shiftsForDay
    };
  });

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Weekly Schedule</h1>
        
        {canEdit && (
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleCopyLastWeek} className="hidden sm:flex">
              Copy Last Week
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Add Shift
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <Button variant="outline" size="icon" onClick={handlePreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <CardTitle className="text-xl">
            {currentWeekStart.toLocaleDateString()} - {weekEnd.toLocaleDateString()}
          </CardTitle>
          <Button variant="outline" size="icon" onClick={handleNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x border-b last:border-0 min-h-[500px]">
            {groupedSchedules.map((col, i) => (
              <div key={i} className="flex flex-col flex-1 p-4 bg-muted/10">
                <div className="text-center mb-4">
                  <div className="font-semibold text-foreground">{col.dayName}</div>
                  <div className="text-xs text-muted-foreground">{col.date.toLocaleDateString()}</div>
                </div>

                <div className="space-y-3 flex-1">
                  {col.shifts.length === 0 ? (
                    <div className="text-center text-xs text-muted-foreground italic mt-6">
                      No shifts
                    </div>
                  ) : (
                    col.shifts.map(shift => {
                      const startStr = new Date(shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const endStr = new Date(shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const isMe = shift.userId === currentUserId;

                      return (
                        <div 
                          key={shift.id} 
                          className={`relative group p-3 rounded-lg border text-sm ${
                            shift.isOnLeave 
                              ? 'bg-muted/30 border-dashed border-2 border-muted-foreground/30 text-muted-foreground dark:bg-muted/10' 
                              : isMe ? 'bg-blue-500/10 border-blue-200' : 'bg-background border-border shadow-sm'
                          }`}
                        >
                          <div className={`font-semibold truncate ${shift.isOnLeave ? 'line-through opacity-70' : ''}`}>{shift.user.name}</div>
                          {shift.isOnLeave ? (
                            <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-muted text-muted-foreground px-2 py-0.5 rounded-sm">Time Off</span>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground mt-1">
                              {startStr} - {endStr}
                            </div>
                          )}
                          {shift.notes && (
                            <div className={`text-xs mt-1.5 ${shift.isOnLeave ? 'text-muted-foreground/70 italic' : 'text-primary/70'}`}>{shift.notes}</div>
                          )}

                          {canEdit && (
                            <button
                              onClick={() => handleDeleteShift(shift.id)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10 p-1 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Shift Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Staff Member</Label>
              <Select 
                value={formData.userId} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, userId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff..." />
                </SelectTrigger>
                <SelectContent>
                  {(staff || []).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input 
                type="date" 
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input 
                  type="time" 
                  value={formData.startTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input 
                  type="time" 
                  value={formData.endTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input 
                placeholder="Manager on duty, closing, etc." 
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input 
                type="checkbox" 
                id="onLeave" 
                checked={formData.isOnLeave}
                onChange={(e) => setFormData(prev => ({ ...prev, isOnLeave: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300"
              />
              <Label htmlFor="onLeave" className="cursor-pointer">Mark as "On Leave" / Time Off</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateShift}>Assign Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
