'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getTimesheets, adminUpdateRecord, adminDeleteRecord, adminCreateRecord } from '@/server/actions/attendance.actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Edit2, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export function TimesheetsView() {
  const getLocalDateString = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return getLocalDateString(d);
  });
  
  const [endDate, setEndDate] = useState(() => {
    return getLocalDateString(new Date());
  });

  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({});
  
  // EDIT DIALOG STATE
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editClockIn, setEditClockIn] = useState('');
  const [editClockOut, setEditClockOut] = useState('');

  // ADD RECORD STATE
  const [addRecordUser, setAddRecordUser] = useState<any>(null);
  const [addClockIn, setAddClockIn] = useState('');
  const [addClockOut, setAddClockOut] = useState('');

  const fetcher = async () => {
    const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
    const s = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);

    const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
    const e = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);
    
    const res = await getTimesheets(s, e);
    return res.success ? res.data : [];
  };

  const { data: timesheets, isLoading, mutate } = useSWR(`timesheets-${startDate}-${endDate}`, fetcher);

  const toggleUser = (userId: string) => {
    setExpandedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const openEditDialog = (record: any) => {
    setEditRecord(record);
    
    // Convert Dates to local datetime-local string format
    const formatForInput = (d: Date) => {
        const offset = d.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
        return localISOTime;
    };

    setEditClockIn(formatForInput(new Date(record.clockIn)));
    setEditClockOut(record.clockOut ? formatForInput(new Date(record.clockOut)) : '');
  };

  const handleSaveEdit = async () => {
      if (!editClockIn) {
          toast.error("Clock In time is required");
          return;
      }
      
      const inDate = new Date(editClockIn);
      const outDate = editClockOut ? new Date(editClockOut) : null;

      if (outDate && outDate < inDate) {
          toast.error("Clock Out time must be after Clock In");
          return;
      }

      const res = await adminUpdateRecord(editRecord.id, inDate, outDate);
      if (res.success) {
          toast.success("Record updated");
          setEditRecord(null);
          mutate();
      } else {
          toast.error(res.error);
      }
  };

  const handleDelete = async (recordId: string) => {
      if (confirm('Are you sure you want to delete this punch record?')) {
          const res = await adminDeleteRecord(recordId);
          if (res.success) {
              toast.success("Record deleted");
              mutate();
          } else {
              toast.error(res.error);
          }
      }
  };

  const handleSaveAdd = async () => {
      if (!addClockIn || !addRecordUser) {
          toast.error("Clock In time is required");
          return;
      }
      
      const inDate = new Date(addClockIn);
      const outDate = addClockOut ? new Date(addClockOut) : null;

      if (outDate && outDate < inDate) {
          toast.error("Clock Out time must be after Clock In");
          return;
      }

      const res = await adminCreateRecord(addRecordUser.id, inDate, outDate);
      if (res.success) {
          toast.success("Record added");
          setAddRecordUser(null);
          setAddClockIn('');
          setAddClockOut('');
          mutate();
      } else {
          toast.error(res.error);
      }
  };

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Timesheets & Attendance</h1>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-xl">Report Range</CardTitle>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <Label>From:</Label>
                <Input 
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                />
             </div>
             <div className="flex items-center gap-2">
                <Label>To:</Label>
                <Input 
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                />
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Shifts Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : !timesheets || timesheets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No attendance records found for this period</TableCell>
                </TableRow>
              ) : (
                timesheets.map((ts: any) => {
                  const hours = Math.floor(ts.totalMinutes / 60);
                  const mins = ts.totalMinutes % 60;
                  const isExpanded = expandedUsers[ts.user.id];
                  
                  return (
                    <React.Fragment key={ts.user.id}>
                        {/* Parent Row */}
                        <TableRow 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleUser(ts.user.id)}
                        >
                        <TableCell>
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground"/> : <ChevronRight className="w-4 h-4 text-muted-foreground"/>}
                        </TableCell>
                        <TableCell className="font-medium">
                            {ts.user.name}
                            <br/>
                            <span className="text-xs text-muted-foreground">ID: {ts.user.employeeId}</span>
                        </TableCell>
                        <TableCell>{ts.user.role.replace('_', ' ')}</TableCell>
                        <TableCell className="font-bold">
                            {hours}h {mins}m
                        </TableCell>
                        <TableCell>{ts.records.length} shifts</TableCell>
                        </TableRow>
                        
                        {/* Expanded Children */}
                        {isExpanded && (
                            <TableRow className="bg-muted/20">
                                <TableCell colSpan={5} className="p-0">
                                    <div className="p-4 pl-14 border-b border-border shadow-inner bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-semibold text-sm">Individual Punch Records</h4>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-7 text-xs gap-1"
                                                onClick={() => setAddRecordUser(ts.user)}
                                            >
                                                <Plus className="w-3 h-3"/> Add Missing Record
                                            </Button>
                                        </div>
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="h-8">Date</TableHead>
                                                    <TableHead className="h-8">Clock In</TableHead>
                                                    <TableHead className="h-8">Clock Out</TableHead>
                                                    <TableHead className="h-8 text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {ts.records.map((r: any) => (
                                                    <TableRow key={r.id}>
                                                        <TableCell>{format(new Date(r.clockIn), 'MMM d, yyyy')}</TableCell>
                                                        <TableCell>{format(new Date(r.clockIn), 'h:mm a')}</TableCell>
                                                        <TableCell>
                                                            {r.clockOut ? format(new Date(r.clockOut), 'h:mm a') : <span className="text-emerald-600 font-semibold animate-pulse">Running...</span>}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(r)}>
                                                                    <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                                                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Record Dialog */}
      <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Punch Record</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Clock In</Label>
                    <Input 
                        type="datetime-local" 
                        value={editClockIn}
                        onChange={e => setEditClockIn(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Clock Out (Optional if ongoing)</Label>
                    <Input 
                        type="datetime-local" 
                        value={editClockOut}
                        onChange={e => setEditClockOut(e.target.value)}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setEditRecord(null)}>Cancel</Button>
                <Button onClick={handleSaveEdit}>Save Changes</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Record Dialog */}
      <Dialog open={!!addRecordUser} onOpenChange={(open) => !open && setAddRecordUser(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add Missing Record for {addRecordUser?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>Clock In</Label>
                    <Input 
                        type="datetime-local" 
                        value={addClockIn}
                        onChange={e => setAddClockIn(e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Clock Out (Optional)</Label>
                    <Input 
                        type="datetime-local" 
                        value={addClockOut}
                        onChange={e => setAddClockOut(e.target.value)}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setAddRecordUser(null)}>Cancel</Button>
                <Button onClick={handleSaveAdd}>Create Record</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
