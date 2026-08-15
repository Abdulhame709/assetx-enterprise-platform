'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardList, FilterX, PlayCircle, Search, Wrench } from 'lucide-react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/states';
import { MaintenanceOrderPanel } from '@/features/maintenance/components/MaintenanceOrderPanel';
import { useMaintenanceOrders } from '@/features/maintenance/use-maintenance';
import { useI18n } from '@/lib/i18n';

export default function MaintenancePage() {
  const state = useMaintenanceOrders();
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const [workflow, setWorkflow] = useState<'all' | 'open' | 'in_progress' | 'completed' | 'cancelled'>('all');
  const formatMessage = (key: string, values: Record<string, number>) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value.toLocaleString(locale)), t(key));

  return <div className="space-y-4">
    <PageHeader title={t('nav.maintenance')} subtitle={t('module.maintenanceSubtitle')} />
    <AsyncBoundary state={state}>{(orders) => {
      const openOrders = orders.filter((order) => order.workflow_status === 'open').length;
      const inProgressOrders = orders.filter((order) => order.workflow_status === 'in_progress').length;
      const completedOrders = orders.filter((order) => order.workflow_status === 'completed').length;
      const highPriorityOrders = orders.filter((order) => order.priority === 'high' || order.priority === 'critical').length;
      const visibleOrders = (() => {
        const term = query.trim().toLocaleLowerCase(locale);
        return orders.filter((order) => {
          const matchesStatus = workflow === 'all' || order.workflow_status === workflow;
          const matchesQuery = !term || [order.asset_name, order.asset_code, order.maintenance_code, order.technician_name]
            .some((value) => value?.toLocaleLowerCase(locale).includes(term));
          return matchesStatus && matchesQuery;
        });
      })();
      const filtered = Boolean(query.trim() || workflow !== 'all');
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

        <section className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4" aria-label={t('maintenance.controlsTitle')}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-semibold text-ink">{t('maintenance.controlsTitle')}</h2><p className="text-xs text-ink-muted">{formatMessage('maintenance.resultsSummary', { shown: visibleOrders.length, total: orders.length })}</p></div>{filtered && <Button variant="ghost" size="sm" onClick={() => { setQuery(''); setWorkflow('all'); }}><FilterX className="h-3.5 w-3.5" /> {t('maintenance.clearFilters')}</Button>}</div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]"><label className="relative block"><span className="sr-only">{t('maintenance.search')}</span><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('maintenance.search')} className="ax-input w-full py-2 ps-9" /></label><select value={workflow} onChange={(event) => setWorkflow(event.target.value as typeof workflow)} className="ax-input w-full py-2"><option value="all">{t('maintenance.allStatuses')}</option>{(['open', 'in_progress', 'completed', 'cancelled'] as const).map((value) => <option key={value} value={value}>{t(`maintenance.status.${value}`)}</option>)}</select></div>
        </section>

        <Card className="overflow-hidden p-0 shadow-card"><CardHeader title={t('maintenance.ordersTitle')} subtitle={t('maintenance.ordersSubtitle')} /><CardBody className="pt-0">{visibleOrders.length || !filtered ? <MaintenanceOrderPanel orders={visibleOrders} onChanged={state.reload} /> : <EmptyState title={t('maintenance.noMatch')} description={t('maintenance.noMatchDesc')} />}</CardBody></Card>
      </div>;
    }}</AsyncBoundary>
  </div>;
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof Wrench; label: string; value: string; tone: 'brand' | 'warning' | 'danger' }) {
  const toneClass = { brand: 'bg-brand-soft text-brand', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger' }[tone];
  return <div className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4"><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></span><span className="text-2xl font-semibold tabular-nums text-ink">{value}</span></div><p className="mt-3 text-xs font-medium text-ink-muted">{label}</p></div>;
}
