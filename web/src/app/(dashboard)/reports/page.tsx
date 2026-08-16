'use client';

import { Activity, Archive, BarChart3, CircleCheckBig, Download, Eye, FileDown, Layers3, MapPin, PackageCheck, Printer, RefreshCw, Users, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommandToolbar } from '@/components/ui/CommandToolbar';
import { useToast } from '@/components/ui/Toast';
import { useAnalytics } from '@/features/assets/use-assets';
import { downloadAssetExport } from '@/features/assets/api';
import type { AnalyticsBucket, LifecycleDistributionBucket } from '@/features/assets/types';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

interface DistributionPanelProps {
  title: string;
  subtitle: string;
  buckets: AnalyticsBucket[];
  icon: LucideIcon;
  emptyLabel: string;
}

function DistributionPanel({ title, subtitle, buckets, icon: Icon, emptyLabel }: DistributionPanelProps) {
  const max = Math.max(...buckets.map((bucket) => bucket.count), 0);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <Card className="min-w-0">
      <CardHeader title={title} subtitle={subtitle} actions={<Icon className="h-4 w-4 text-brand" aria-hidden="true" />} />
      <CardBody>
        {buckets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center text-sm text-ink-muted">
            {emptyLabel}
          </div>
        ) : (
          <div className="space-y-4">
            {buckets.slice(0, 6).map((bucket) => {
              const percentage = total > 0 ? Math.round((bucket.count / total) * 100) : 0;
              const width = max > 0 ? Math.max((bucket.count / max) * 100, 5) : 0;
              return (
                <div key={bucket.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium text-ink" title={bucket.name}>{bucket.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-muted">{bucket.count.toLocaleString()} · {percentage}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${bucket.name}: ${percentage}%`}>
                    <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
            {buckets.length > 6 && <p className="pt-1 text-xs text-ink-faint">+{buckets.length - 6} more groups</p>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

interface LifecyclePanelProps {
  title: string;
  subtitle: string;
  buckets: LifecycleDistributionBucket[];
  emptyLabel: string;
}

function LifecyclePanel({ title, subtitle, buckets, emptyLabel }: LifecyclePanelProps) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  return (
    <Card className="min-w-0">
      <CardHeader title={title} subtitle={subtitle} actions={<Activity className="h-4 w-4 text-brand" aria-hidden="true" />} />
      <CardBody>
        {buckets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-8 text-center text-sm text-ink-muted">
            {emptyLabel}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {buckets.map((bucket) => {
              const percentage = total > 0 ? Math.round((bucket.count / total) * 100) : 0;
              return (
                <div key={bucket.state} className="rounded-xl border border-border bg-surface-muted/30 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{humanize(bucket.state)}</span>
                    <span className="text-lg font-semibold tabular-nums text-ink">{bucket.count.toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{percentage}% of assets</p>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function ReportsPage() {
  const state = useAnalytics();
  const toast = useToast();
  const { t, locale } = useI18n();
  const [exporting, setExporting] = useState(false);

  const download = async (format: 'csv' | 'pdf' = 'csv') => {
    setExporting(true);
    try {
      await downloadAssetExport(format);
      toast.success(t('module.reportsExportReady'), t('module.reportsExportMessage'));
    } catch (error) {
      toast.error(t('module.reportsExportFailed'), humanError(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.reports')} subtitle={t('module.reportsSubtitle')} />
      <CommandToolbar
        label={t('module.reportsToolbar')}
        actions={[
          { id: 'refresh', label: t('common.refresh'), icon: RefreshCw, onClick: state.reload, loading: state.status === 'loading' },
          { id: 'export', label: t('module.reportsExport'), icon: Download, onClick: () => void download('csv'), loading: exporting, variant: 'primary' },
          { id: 'export-pdf', label: t('common.exportPdf'), icon: FileDown, onClick: () => void download('pdf'), loading: exporting },
          { id: 'print', label: t('common.print'), icon: Printer, onClick: () => window.print(), separated: true },
          { id: 'view-assets', label: t('module.reportsViewAssets'), icon: Eye, href: '/assets', separated: true },
        ]}
      />
      <AsyncBoundary state={state}>
        {(data) => {
          const activeRate = data.total_assets > 0 ? Math.round((data.active_assets / data.total_assets) * 100) : 0;
          const assignedRate = data.total_assets > 0 ? Math.round((data.assigned_assets / data.total_assets) * 100) : 0;
          const summary = `${activeRate}% ${t('module.reportsActive').toLowerCase()} · ${assignedRate}% ${t('assetDashboard.assigned').toLowerCase()}`;

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <KpiCard label={t('module.reportsTotal')} value={data.total_assets.toLocaleString(locale)} icon={Layers3} tone="info" />
                <KpiCard label={t('module.reportsActive')} value={data.active_assets.toLocaleString(locale)} icon={CircleCheckBig} tone="success" />
                <KpiCard label={t('assetDashboard.assigned')} value={data.assigned_assets.toLocaleString(locale)} icon={Users} tone="brand" />
                <KpiCard label={t('assetDashboard.maintenance')} value={data.maintenance_assets.toLocaleString(locale)} icon={Wrench} tone="warning" />
                <KpiCard label={t('assetDashboard.disposed')} value={data.disposed_assets.toLocaleString(locale)} icon={PackageCheck} tone="danger" />
                <KpiCard label={t('assetDashboard.archived')} value={data.archived_assets.toLocaleString(locale)} icon={Archive} tone="neutral" />
              </div>

              <Card className="overflow-hidden border-brand/20 bg-gradient-to-br from-brand-soft/60 via-surface to-surface">
                <CardBody className="flex flex-col gap-4">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-brand/10 p-2.5 text-brand"><BarChart3 className="h-5 w-5" aria-hidden="true" /></span>
                    <div>
                      <p className="font-semibold text-ink">{t('module.reportsExportTitle')}</p>
                      <p className="mt-1 text-sm text-ink-muted">{t('module.reportsExportDesc')}</p>
                      <p className="mt-2 text-xs font-medium text-brand">{summary}</p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <DistributionPanel
                  title={t('assetDashboard.byCategory')}
                  subtitle={t('assetDashboard.currentStateMix')}
                  buckets={data.by_category}
                  icon={Layers3}
                  emptyLabel={t('states.emptyDescription')}
                />
                <DistributionPanel
                  title={t('assetDashboard.byLocation')}
                  subtitle={t('assetDashboard.currentStateMix')}
                  buckets={data.by_location}
                  icon={MapPin}
                  emptyLabel={t('states.emptyDescription')}
                />
              </div>

              <LifecyclePanel
                title={t('assetDashboard.lifecycleDistribution')}
                subtitle={t('assetDashboard.distribution')}
                buckets={data.lifecycle_distribution}
                emptyLabel={t('states.emptyDescription')}
              />
            </div>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}
