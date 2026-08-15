'use client';

import Link from 'next/link';
import { Boxes, CheckCircle2, UserCheck, Wrench, Trash2, Archive } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { useAnalytics } from '@/features/assets/use-assets';
import { BarList, Donut } from '@/features/assets/components/Charts';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useI18n } from '@/lib/i18n';

export default function AssetDashboardPage() {
  const state = useAnalytics();
  const { t, label, locale } = useI18n();

  return (
    <div>
      <PageHeader
        title={t('assetDashboard.title')}
        subtitle={t('assetDashboard.subtitle')}
        actions={
          <PermissionGate permission={PERMISSIONS.ASSET_VIEW}>
            <Link href="/assets" className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand/90">
              {t('assetDashboard.viewAll')}
            </Link>
          </PermissionGate>
        }
      />

      <AsyncBoundary state={state}>
        {(data) => (
          <>
            {/* KPI cards */}
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard label={t('assetDashboard.total')} value={data.total_assets.toLocaleString(locale)} icon={Boxes} tone="info" />
              <KpiCard label={t('assetDashboard.active')} value={data.active_assets.toLocaleString(locale)} icon={CheckCircle2} tone="success" />
              <KpiCard label={t('assetDashboard.assigned')} value={data.assigned_assets.toLocaleString(locale)} icon={UserCheck} tone="brand" />
              <KpiCard label={t('assetDashboard.maintenance')} value={data.maintenance_assets.toLocaleString(locale)} icon={Wrench} tone="warning" />
              <KpiCard label={t('assetDashboard.disposed')} value={data.disposed_assets.toLocaleString(locale)} icon={Trash2} tone="danger" />
              <KpiCard label={t('assetDashboard.archived')} value={data.archived_assets.toLocaleString(locale)} icon={Archive} tone="neutral" />
            </div>

            {/* Distributions */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader title={t('assetDashboard.byCategory')} subtitle={t('assetDashboard.distribution')} />
                <CardBody><BarList data={data.by_category} /></CardBody>
              </Card>
              <Card>
                <CardHeader title={t('assetDashboard.byLocation')} subtitle={t('assetDashboard.distribution')} />
                <CardBody><BarList data={data.by_location} /></CardBody>
              </Card>
              <Card>
                <CardHeader title={t('assetDashboard.lifecycleDistribution')} subtitle={t('assetDashboard.currentStateMix')} />
                <CardBody><Donut data={data.lifecycle_distribution.map((d) => ({ name: d.state, count: d.count }))} /></CardBody>
              </Card>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {data.lifecycle_distribution.slice(0, 8).map((d) => (
                <Badge key={d.state} tone="neutral" className="capitalize">
                  {label(d.state)}: {d.count.toLocaleString(locale)}
                </Badge>
              ))}
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
