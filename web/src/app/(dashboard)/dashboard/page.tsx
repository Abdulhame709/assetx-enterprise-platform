'use client';

import { Boxes, Wrench, AlertTriangle, Activity } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { useAnalytics } from '@/features/assets/use-assets';
import { BarList, Donut } from '@/features/assets/components/Charts';
import { useSession } from '@/lib/auth/session-context';

export default function DashboardPage() {
  const { session } = useSession();
  const state = useAnalytics();

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session?.user.displayName?.split(' ')[0] ?? 'there'}`}
        subtitle="Executive overview of your asset estate"
      />

      <AsyncBoundary state={state}>
        {(data) => (
          <>
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label="Total Assets" value={data.total_assets.toLocaleString()} icon={Boxes} tone="info" />
              <KpiCard label="Active Assets" value={data.active_assets.toLocaleString()} icon={Activity} tone="success" />
              <KpiCard label="In Maintenance" value={data.maintenance_assets.toLocaleString()} icon={Wrench} tone="warning" />
              <KpiCard label="Assigned" value={data.assigned_assets.toLocaleString()} icon={AlertTriangle} tone="brand" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader title="By Category" />
                <CardBody><BarList data={data.by_category} /></CardBody>
              </Card>
              <Card>
                <CardHeader title="By Location" />
                <CardBody><BarList data={data.by_location} /></CardBody>
              </Card>
              <Card>
                <CardHeader title="Lifecycle Mix" />
                <CardBody><Donut data={data.lifecycle_distribution.map((d) => ({ name: d.state, count: d.count }))} /></CardBody>
              </Card>
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
