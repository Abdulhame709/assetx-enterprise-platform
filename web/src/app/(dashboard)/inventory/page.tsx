'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, ClipboardList, PackageCheck, PlayCircle, Printer, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommandToolbar } from '@/components/ui/CommandToolbar';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useToast } from '@/components/ui/Toast';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';
import { useCycles } from '@/features/inventory/use-inventory';
import { CycleFormModal } from '@/features/inventory/components/CycleFormModal';
import { CycleStatus } from '@/features/inventory/api';

const CYCLE_TONE: Record<CycleStatus, BadgeTone> = { new: 'neutral', in_progress: 'warning', closed: 'success' };

function formatDate(date: string | null, locale: string): string { return date ? new Date(date).toLocaleDateString(locale) : '—'; }

export default function InventoryPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const state = useCycles();
  const toast = useToast();
  const { label, t, locale } = useI18n();
  const cycles = state.data ?? [];
  const activeCycles = cycles.filter(({ cycle }) => cycle.status === 'in_progress').length;
  const closedCycles = cycles.filter(({ cycle }) => cycle.status === 'closed').length;
  const totalExpected = cycles.reduce((total, item) => total + (item.summary?.expected_assets ?? 0), 0);
  const totalPending = cycles.reduce((total, item) => total + (item.summary?.not_inventoried ?? 0), 0);
  const formatMessage = (key: string, values: Record<string, number>) => Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, value.toLocaleString(locale)), t(key));

  return <div className="space-y-4">
    <PageHeader title={t('inventory.cycle')} subtitle={formatMessage('inventory.subtitle', { count: cycles.length })} />
    <CommandToolbar
      label={t('inventory.commandToolbar')}
      actions={[
        { id: 'refresh', label: t('common.refresh'), icon: RefreshCw, onClick: state.reload, loading: state.status === 'loading' },
        { id: 'print', label: t('common.print'), icon: Printer, onClick: () => window.print(), separated: true },
        { id: 'add', label: t('inventory.newCycle'), icon: ClipboardCheck, onClick: () => setCreateOpen(true), permission: PERMISSIONS.INVENTORY_CREATE, variant: 'primary' },
      ]}
    />

    <section aria-label={t('inventory.metrics')} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard icon={ClipboardList} label={t('inventory.totalCycles')} value={cycles.length.toLocaleString(locale)} tone="brand" />
      <MetricCard icon={PlayCircle} label={t('inventory.activeCycles')} value={activeCycles.toLocaleString(locale)} tone="warning" />
      <MetricCard icon={PackageCheck} label={t('inventory.snapshotAssets')} value={totalExpected.toLocaleString(locale)} tone="success" />
      <MetricCard icon={CalendarDays} label={t('inventory.pendingCount')} value={totalPending.toLocaleString(locale)} tone="danger" />
    </section>

    <section className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4" aria-label={t('inventory.reviewTitle')}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand"><ClipboardCheck className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-ink">{t('inventory.reviewTitle')}</h2><p className="text-xs text-ink-muted">{formatMessage('inventory.reviewSummary', { total: cycles.length, closed: closedCycles })}</p></div></div><span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-medium text-ink-muted">{formatMessage('inventory.activeSummary', { count: activeCycles })}</span></div>
    </section>

    <Card className="overflow-hidden p-0 shadow-card"><CardBody className="p-0">
      {state.status === 'loading' && <LoadingState rows={4} />}
      {state.status === 'error' && <ErrorState message={humanError(state.error, t('common.genericError'), locale)} onRetry={state.reload} />}
      {state.status === 'success' && cycles.length === 0 && <EmptyState title={t('inventory.noCycles')} description={t('inventory.createCycleHint')} actionLabel={t('inventory.createCycle')} onAction={() => setCreateOpen(true)} />}
      {state.status === 'success' && cycles.length > 0 && <div className="divide-y divide-line">{cycles.map(({ cycle, summary }) => {
        const expected = summary?.expected_assets ?? 0;
        const inventoried = summary?.inventoried ?? 0;
        const completion = summary?.completion ?? 0;
        const pending = summary?.not_inventoried ?? Math.max(expected - inventoried, 0);
        const toneClass = cycle.status === 'closed' ? 'bg-success-soft text-success' : cycle.status === 'in_progress' ? 'bg-warning-soft text-warning' : 'bg-brand-soft text-brand';
        return <div key={cycle.id} className="p-4 transition-colors hover:bg-surface-muted/50 sm:p-5"><div className="flex flex-wrap items-start gap-4"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneClass}`}><ClipboardList className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-ink">{t('inventory.cycle')} {cycle.year}</h3><Badge tone={CYCLE_TONE[cycle.status]}>{label(cycle.status)}</Badge>{cycle.status === 'closed' && <CheckCircle2 className="h-4 w-4 text-success" aria-label={t('inventory.closed')} />}</div><p className="mt-1 text-xs text-ink-muted">{cycle.start_date ? `${t('inventory.started')} ${formatDate(cycle.start_date, locale)}` : t('inventory.notStarted')} <span className="px-1 text-ink-faint">·</span> {cycle.end_date ? `${t('inventory.closed')} ${formatDate(cycle.end_date, locale)}` : t('inventory.notClosed')}</p></div><Link href={`/inventory/${cycle.id}`} aria-label={t('inventory.open')} title={t('inventory.open')} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"><ArrowRight className="h-4 w-4 rtl:-scale-x-100" /></Link></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3"><MiniMetric label={t('inventory.expected')} value={expected.toLocaleString(locale)} /><MiniMetric label={t('inventory.counted')} value={inventoried.toLocaleString(locale)} /><MiniMetric label={t('inventory.pending')} value={pending.toLocaleString(locale)} tone={pending > 0 ? 'danger' : 'default'} /></div>
          <div className="mt-4"><div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-medium text-ink-muted">{t('inventory.progress')}</span><span className="font-semibold tabular-nums text-ink">{completion}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${Math.min(Math.max(completion, 0), 100)}%` }} /></div></div>
        </div>;
      })}</div>}
    </CardBody></Card>
    {createOpen && <CycleFormModal open onClose={() => setCreateOpen(false)} onCreated={(cycle, snapshotCount) => { toast.success(t('inventory.cycleCreated'), `${t('inventory.cycle')} ${cycle.year} — ${snapshotCount} ${t('inventory.snapshotted')}`); setCreateOpen(false); state.reload(); }} />}
  </div>;
}

function MiniMetric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'danger' }) { return <div className="rounded-lg border border-line bg-surface px-3 py-2"><p className="text-xs text-ink-faint">{label}</p><p className={tone === 'danger' ? 'mt-1 text-sm font-semibold tabular-nums text-danger' : 'mt-1 text-sm font-semibold tabular-nums text-ink'}>{value}</p></div>; }
function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof ClipboardList; label: string; value: string; tone: 'brand' | 'success' | 'warning' | 'danger' }) { const toneClass = { brand: 'bg-brand-soft text-brand', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger' }[tone]; return <div className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4"><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></span><span className="text-2xl font-semibold tabular-nums text-ink">{value}</span></div><p className="mt-3 text-xs font-medium text-ink-muted">{label}</p></div>; }
