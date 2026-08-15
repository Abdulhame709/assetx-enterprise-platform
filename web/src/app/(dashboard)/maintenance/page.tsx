'use client';

import { Wrench } from 'lucide-react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { MaintenanceOrderPanel } from '@/features/maintenance/components/MaintenanceOrderPanel';
import { useMaintenanceOrders } from '@/features/maintenance/use-maintenance';
import { useI18n } from '@/lib/i18n';

export default function MaintenancePage() {
  const state = useMaintenanceOrders();
  const { t, locale } = useI18n();
  return (
    <div>
      <PageHeader title={t('nav.maintenance')} subtitle={t('module.maintenanceSubtitle')} />
      <AsyncBoundary state={state}>
        {(orders) => (
          <div className="space-y-4">
            <KpiCard label={t('maintenance.openCount')} value={orders.filter((order) => order.workflow_status !== 'completed' && order.workflow_status !== 'cancelled').length.toLocaleString(locale)} icon={Wrench} tone="warning" />
            <Card>
              <CardHeader title={t('maintenance.ordersTitle')} subtitle={t('maintenance.ordersSubtitle')} />
              <CardBody><MaintenanceOrderPanel orders={orders} onChanged={state.reload} /></CardBody>
            </Card>
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
