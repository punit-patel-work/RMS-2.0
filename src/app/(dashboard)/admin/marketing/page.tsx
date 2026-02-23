import { getMarketingDashboardStats } from '@/server/queries/crm.queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Coins, TrendingUp, AlertCircle } from 'lucide-react';
import { MockCampaignCreator } from '@/components/admin/mock-campaign-creator';

export const dynamic = 'force-dynamic';

export default async function MarketingDashboard() {
  const stats = await getMarketingDashboardStats();

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Loyalty & Marketing</h1>
        <p className="text-sm text-muted-foreground">
          View customer segments and send targeted promotional campaigns.
        </p>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">Enrolled in Loyalty</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Liability</CardTitle>
            <Coins className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPoints}</div>
            <p className="text-xs text-muted-foreground">Unredeemed points in circulation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active (30 Days)</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCount}</div>
            <p className="text-xs text-muted-foreground">Ordered recently</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk (+60 Days)</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.atRiskCount}</div>
            <p className="text-xs text-muted-foreground">Haven't ordered in 2 months</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Top VIP list */}
         <Card className="lg:col-span-1">
            <CardHeader>
               <CardTitle>Top 5 VIPs</CardTitle>
            </CardHeader>
            <CardContent>
               {stats.vips.length > 0 ? (
                  <div className="space-y-4">
                     {stats.vips.map((vip, idx) => (
                        <div key={vip.id} className="flex justify-between items-center text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0">
                           <div className="flex gap-3 items-center">
                              <span className="font-bold text-muted-foreground">{idx + 1}.</span>
                              <div>
                                 <p className="font-semibold">{vip.name || 'Anonymous'}</p>
                                 <p className="text-xs text-muted-foreground">{vip.phone}</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <p className="font-bold text-emerald-600 dark:text-emerald-400">{vip.pointsBalance} pts</p>
                              <p className="text-xs text-muted-foreground">{vip._count.orders} orders</p>
                           </div>
                        </div>
                     ))}
                  </div>
               ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center italic">No VIP data available yet.</p>
               )}
            </CardContent>
         </Card>

         {/* Campaign Creator Mock */}
         <div className="lg:col-span-2">
            <MockCampaignCreator 
               activeCount={stats.activeCount} 
               atRiskCount={stats.atRiskCount}
            />
         </div>
      </div>
    </div>
  );
}
