'use client';

import { Boxes, Wrench, AlertTriangle, Activity } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { useAnalytics } from '@/features/assets/use-assets';
import { BarList, Donut } from '@/features/assets/components/Charts';
import { useSession } from '@/lib/auth/session-context';
import { useI18n } from '@/lib/i18n';

export default function DashboardPage() {
  const { session } = useSession();
  const state = useAnalytics();
  const { t, locale } = useI18n();
  const displayName = session?.user.displayName?.split(' ')[0] ?? t('dashboard.welcomeFallback');

  return (
    <div>
      <PageHeader
        title={t('dashboard.welcome').replace('{name}', displayName)}
        subtitle={t('dashboard.subtitle')}
      />

      <AsyncBoundary state={state}>
        {(data) => (
          <>
            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label={t('dashboard.total')} value={data.total_assets.toLocaleString(locale)} icon={Boxes} tone="info" />
              <KpiCard label={t('dashboard.active')} value={data.active_assets.toLocaleString(locale)} icon={Activity} tone="success" />
              <KpiCard label={t('dashboard.maintenance')} value={data.maintenance_assets.toLocaleString(locale)} icon={Wrench} tone="warning" />
              <KpiCard label={t('dashboard.assigned')} value={data.assigned_assets.toLocaleString(locale)} icon={AlertTriangle} tone="brand" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader title={t('dashboard.byCategory')} />
                <CardBody><BarList data={data.by_category} /></CardBody>
              </Card>
              <Card>
                <CardHeader title={t('dashboard.byLocation')} />
                <CardBody><BarList data={data.by_location} /></CardBody>
              </Card>
              <Card>
                <CardHeader title={t('dashboard.lifecycleMix')} />
                <CardBody><Donut data={data.lifecycle_distribution.map((d) => ({ name: d.state, count: d.count }))} /></CardBody>
              </Card>
            </div>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
