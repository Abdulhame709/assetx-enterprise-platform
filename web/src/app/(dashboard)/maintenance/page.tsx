'use client';

import { AlertTriangle, CheckCircle2, ClipboardList, PlayCircle, Wrench } from 'lucide-react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { MaintenanceOrderPanel } from '@/features/maintenance/components/MaintenanceOrderPanel';
import { useMaintenanceOrders } from '@/features/maintenance/use-maintenance';
import { useI18n } from '@/lib/i18n';

export default function MaintenancePage() {
  const state = useMaintenanceOrders();
  const { t, locale } = useI18n();
  const formatMessage = (key: string, values: Record<string, number>) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value.toLocaleString(locale)), t(key));

  return <div className="space-y-4">
    <PageHeader title={t('nav.maintenance')} subtitle={t('module.maintenanceSubtitle')} />
    <AsyncBoundary state={state}>{(orders) => {
      const openOrders = orders.filter((order) => order.workflow_status === 'open').length;
      const inProgressOrders = orders.filter((order) => order.workflow_status === 'in_progress').length;
      const completedOrders = orders.filter((order) => order.workflow_status === 'completed').length;
      const highPriorityOrders = orders.filter((order) => order.priority === 'high' || order.priority === 'critical').length;
      return <div className="space-y-4">
        <section aria-label={t('maintenance.metrics')} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard icon={ClipboardList} label={t('maintenance.totalOrders')} value={orders.length.toLocaleString(locale)} tone="brand" />
          <MetricCard icon={Wrench} label={t('maintenance.openCount')} value={openOrders.toLocaleString(locale)} tone="warning" />
          <MetricCard icon={PlayCircle} label={t('maintenance.inProgressCount')} value={inProgressOrders.toLocaleString(locale)} tone="brand" />
          <MetricCard icon={AlertTriangle} label={t('maintenance.highPriorityCount')} value={highPriorityOrders.toLocaleString(locale)} tone="danger" />
        </section>

        <section className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4" aria-label={t('maintenance.queueTitle')}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand"><Wrench className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-ink">{t('maintenance.queueTitle')}</h2><p className="text-xs text-ink-muted">{formatMessage('maintenance.queueSummary', { total: orders.length, completed: completedOrders })}</p></div></div><span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" /> {formatMessage('maintenance.completedSummary', { count: completedOrders })}</span></div>
        </section>

        <Card className="overflow-hidden p-0 shadow-card"><CardHeader title={t('maintenance.ordersTitle')} subtitle={t('maintenance.ordersSubtitle')} /><CardBody className="pt-0"><MaintenanceOrderPanel orders={orders} onChanged={state.reload} /></CardBody></Card>
      </div>;
    }}</AsyncBoundary>
  </div>;
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof Wrench; label: string; value: string; tone: 'brand' | 'warning' | 'danger' }) {
  const toneClass = { brand: 'bg-brand-soft text-brand', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger' }[tone];
  return <div className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4"><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></span><span className="text-2xl font-semibold tabular-nums text-ink">{value}</span></div><p className="mt-3 text-xs font-medium text-ink-muted">{label}</p></div>;
}
