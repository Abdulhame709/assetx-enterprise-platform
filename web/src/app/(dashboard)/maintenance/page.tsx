'use client';

import Link from 'next/link';
import { Wrench } from 'lucide-react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAnalytics } from '@/features/assets/use-assets';
import { useI18n } from '@/lib/i18n';

export default function MaintenancePage() {
  const state = useAnalytics();
  const { t, locale } = useI18n();
  return (
    <div>
      <PageHeader title={t('nav.maintenance')} subtitle={t('module.maintenanceSubtitle')} />
      <AsyncBoundary state={state}>
        {(data) => (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <KpiCard label={t('module.maintenanceCount')} value={data.maintenance_assets.toLocaleString(locale)} icon={Wrench} tone="warning" />
            <Card>
              <CardHeader title={t('module.maintenanceNoticeTitle')} subtitle={t('module.maintenanceNoticeDesc')} />
              <CardBody><Link href="/assets"><Button variant="secondary">{t('module.maintenanceViewAssets')}</Button></Link></CardBody>
            </Card>
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
