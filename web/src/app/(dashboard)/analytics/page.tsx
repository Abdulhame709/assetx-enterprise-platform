'use client';

import { Activity, Boxes, UserCheck, Wrench } from 'lucide-react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAnalytics } from '@/features/assets/use-assets';
import { useI18n } from '@/lib/i18n';

export default function AnalyticsPage() {
  const state = useAnalytics();
  const { t, label, locale } = useI18n();
  return (
    <div>
      <PageHeader title={t('nav.analytics')} subtitle={t('module.analyticsSubtitle')} />
      <AsyncBoundary state={state}>
        {(data) => (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard label={t('module.analyticsTotal')} value={data.total_assets.toLocaleString(locale)} icon={Boxes} tone="info" />
              <KpiCard label={t('module.analyticsActive')} value={data.active_assets.toLocaleString(locale)} icon={Activity} tone="success" />
              <KpiCard label={t('module.analyticsMaintenance')} value={data.maintenance_assets.toLocaleString(locale)} icon={Wrench} tone="warning" />
              <KpiCard label={t('module.analyticsAssigned')} value={data.assigned_assets.toLocaleString(locale)} icon={UserCheck} tone="brand" />
            </div>
            <Card>
              <CardHeader title={t('module.analyticsStates')} subtitle={t('module.analyticsStatesDesc')} />
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  {data.lifecycle_distribution.map((item) => (
                    <span key={item.state} className="rounded-full bg-surface-muted px-3 py-1.5 text-sm text-ink">
                      {label(item.state)}: {item.count.toLocaleString(locale)}
                    </span>
                  ))}
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}
