'use client';

import Link from 'next/link';
import { Boxes, CheckCircle2, UserCheck, Wrench, Trash2, Archive } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { useAnalytics } from '@/features/assets/use-assets';
import { BarList, Donut } from '@/features/assets/components/Charts';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function AssetDashboardPage() {
  const { data, loading, error, reload } = useAnalytics();

  return (
    <div>
      <PageHeader
        title="Asset Dashboard"
        subtitle="High-level view of the asset estate"
        actions={
          <PermissionGate permission={PERMISSIONS.ASSET_VIEW}>
            <Link href="/assets" className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90">
              View all assets
            </Link>
          </PermissionGate>
        }
      />

      {loading && <LoadingState rows={6} />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          {/* KPI cards */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <KpiCard label="Total Assets" value={data.total_assets.toLocaleString()} icon={Boxes} tone="info" />
            <KpiCard label="Active Assets" value={data.active_assets.toLocaleString()} icon={CheckCircle2} tone="success" />
            <KpiCard label="Assigned Assets" value={data.assigned_assets.toLocaleString()} icon={UserCheck} tone="brand" />
            <KpiCard label="Under Maintenance" value={data.maintenance_assets.toLocaleString()} icon={Wrench} tone="warning" />
            <KpiCard label="Disposed Assets" value={data.disposed_assets.toLocaleString()} icon={Trash2} tone="danger" />
            <KpiCard label="Archived Assets" value={data.archived_assets.toLocaleString()} icon={Archive} tone="neutral" />
          </div>

          {/* Distributions */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="By Category" subtitle="Asset distribution" />
              <CardBody><BarList data={data.by_category} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="By Location" subtitle="Asset distribution" />
              <CardBody><BarList data={data.by_location} /></CardBody>
            </Card>
            <Card>
              <CardHeader title="Lifecycle Distribution" subtitle="Current state mix" />
              <CardBody><Donut data={data.lifecycle_distribution.map((d) => ({ name: d.state, count: d.count }))} /></CardBody>
            </Card>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {data.lifecycle_distribution.slice(0, 8).map((d) => (
              <Badge key={d.state} tone="neutral" className="capitalize">
                {d.state.replace(/_/g, ' ')}: {d.count}
              </Badge>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
