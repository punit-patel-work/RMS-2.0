import { AnalyticsDashboard } from '@/components/admin/analytics-dashboard';

export default function AnalyticsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Sales reports and performance metrics
        </p>
      </div>
      <AnalyticsDashboard />
    </div>
  );
}
