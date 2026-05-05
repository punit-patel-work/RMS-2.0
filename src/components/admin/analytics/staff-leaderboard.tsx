'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { formatCurrency } from '@/lib/pricing';

interface StaffRow {
  id: string;
  name: string;
  role: string;
  revenue: number;
  orders: number;
  avgTicket: number;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  SUPERVISOR: 'Supervisor',
  FLOOR_STAFF: 'Floor',
  KITCHEN_STAFF: 'Kitchen',
};

/**
 * Staff revenue leaderboard. Identifies top performers (incentive structure
 * input) and surfaces underperformance. Bar fills are scaled to the leader's
 * revenue so comparison is visual at a glance.
 */
export function StaffLeaderboard({ data }: { data: StaffRow[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Staff Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No staff orders this period.</p>
        </CardContent>
      </Card>
    );
  }

  const max = data[0].revenue;
  const medalFor = (i: number) => {
    if (i === 0) return <Trophy className="w-4 h-4 text-amber-500" />;
    if (i === 1) return <Medal className="w-4 h-4 text-slate-400" />;
    if (i === 2) return <Award className="w-4 h-4 text-orange-700" />;
    return null;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Staff Performance
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal ml-1">
            ranked by revenue
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.map((staff, i) => (
          <div key={staff.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 flex justify-center">
                  {medalFor(i) ?? (
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      {i + 1}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium truncate">{staff.name}</span>
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                  {ROLE_LABELS[staff.role] ?? staff.role}
                </Badge>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums">
                  {formatCurrency(staff.revenue)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {staff.orders} orders · avg {formatCurrency(staff.avgTicket)}
                </p>
              </div>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all"
                style={{ width: `${(staff.revenue / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
