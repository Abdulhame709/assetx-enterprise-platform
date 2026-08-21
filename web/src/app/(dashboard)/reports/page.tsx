
'use client';

import { Activity, Archive, BarChart3, CircleCheckBig, Download, Eye, Layers3, MapPin, PackageCheck, Printer, RefreshCw, Users, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommandToolbar } from '@/components/ui/CommandToolbar';
import { useToast } from '@/components/ui/Toast';
import { useAnalytics } from '@/features/assets/use-assets';
import { downloadReportExport, ReportFormat, ReportResource } from '@/features/reports/api';
import { Field, Input, Select } from '@/components/ui/form';
import { PERMISSIONS, PermissionKey } from '@/lib/auth/permissions';
import { useCan } from '@/lib/auth/session-context';
import type { AnalyticsBucket, LifecycleDistributionBucket } from '@/features/assets/types';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';

const REPORT_RESOURCES: Array<{ resource: ReportResource; permission: PermissionKey; labelKey: string; descriptionKey: string }> = [
  { resource: 'assets', permission: PERMISSIONS.EXPORT_ASSETS, labelKey: 'module.reportsResourceAssets', descriptionKey: 'module.reportsResourceAssetsDesc' },
  { resource: 'movements', permission: PERMISSIONS.EXPORT_MOVEMENTS, labelKey: 'module.reportsResourceMovements', descriptionKey: 'module.reportsResourceMovementsDesc' },
  { resource: 'inventory', permission: PERMISSIONS.EXPORT_INVENTORY, labelKey: 'module.reportsResourceInventory', descriptionKey: 'module.reportsResourceInventoryDesc' },
  { resource: 'audit', permission: PERMISSIONS.EXPORT_AUDIT, labelKey: 'module.reportsResourceAudit', descriptionKey: 'module.reportsResourceAuditDesc' },
  { resource: 'dashboard', permission: PERMISSIONS.EXPORT_DASHBOARD, labelKey: 'module.reportsResourceDashboard', descriptionKey: 'module.reportsResourceDashboardDesc' },
];

const REPORT_FORMATS: ReportFormat[] = ['csv', 'xlsx', 'pdf'];

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
  const can = useCan();
  const [resource, setResource] = useState<ReportResource>('assets');
  const [format, setFormat] = useState<ReportFormat>('csv');
  const [limit, setLimit] = useState('10000');
  const [exporting, setExporting] = useState(false);
  const availableResources = useMemo(() => REPORT_RESOURCES.filter((item) => can(item.permission)), [can]);
  const selectedResource = availableResources.find((item) => item.resource === resource) ?? availableResources[0] ?? null;
  const printGeneratedAt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  useEffect(() => {
    if (selectedResource && selectedResource.resource !== resource) setResource(selectedResource.resource);
  }, [resource, selectedResource]);

  const download = async () => {
    if (!selectedResource) return;
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100000) {
      toast.error(t('module.reportsExportFailed'), t('module.reportsLimitInvalid'));
      return;
    }
    setExporting(true);
    try {
      await downloadReportExport({ resource: selectedResource.resource, format, limit: parsedLimit });
      toast.success(t('module.reportsExportReady'), t('module.reportsExportMessage'));
    } catch (error) {
      toast.error(t('module.reportsExportFailed'), humanError(error));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="reports-page space-y-6">
      <PageHeader title={t('nav.reports')} subtitle={t('module.reportsSubtitle')} />
      <CommandToolbar
        label={t('module.reportsToolbar')}
        actions={[
          { id: 'refresh', label: t('common.refresh'), icon: RefreshCw, onClick: state.reload, loading: state.status === 'loading' },
          { id: 'export', label: t('module.reportsExport'), icon: Download, onClick: () => void download(), loading: exporting, disabled: !selectedResource, variant: 'primary' },
          { id: 'print', label: t('common.print'), icon: Printer, onClick: () => window.print(), separated: true },
          { id: 'view-assets', label: t('module.reportsViewAssets'), icon: Eye, href: '/assets', separated: true },
        ]}
      />

      <section className="report-print-only rounded-xl border border-brand/30 bg-surface p-5" aria-hidden="true">
        <div className="border-b-2 border-brand pb-3 text-center">
          <p className="text-sm font-semibold text-brand">AssetX Enterprise Platform</p>
          <h1 className="mt-1 text-2xl font-bold text-ink">{t('module.reportsPrintTitle')}</h1>
          <p className="mt-1 text-sm text-ink-muted">{t('module.reportsPrintSubtitle')}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div><span className="font-semibold text-ink">{t('module.reportsPrintSource')}:</span> {selectedResource ? t(selectedResource.labelKey) : t('module.reportsPrintNoSource')}</div>
          <div><span className="font-semibold text-ink">{t('module.reportsPrintFormat')}:</span> {t(`module.reportsFormat.${format}`)}</div>
          <div><span className="font-semibold text-ink">{t('module.reportsPrintLimit')}:</span> {Number(limit || 0).toLocaleString(locale)}</div>
          <div><span className="font-semibold text-ink">{t('module.reportsPrintGeneratedAt')}:</span> {printGeneratedAt}</div>
        </div>
      </section>

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

              <Card className="overflow-hidden border-brand/20 bg-gradient-to-br from-brand-soft/60 via-surface to-surface print-hide">
                <CardBody className="space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="rounded-xl bg-brand/10 p-2.5 text-brand"><BarChart3 className="h-5 w-5" aria-hidden="true" /></span>
                    <div>
                      <p className="font-semibold text-ink">{t('module.reportsExportTitle')}</p>
                      <p className="mt-1 text-sm text-ink-muted">{t('module.reportsExportDesc')}</p>
                      <p className="mt-2 text-xs font-medium text-brand">{summary}</p>
                    </div>
                  </div>
                  {availableResources.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 px-4 py-5 text-sm text-ink-muted">
                      {t('module.reportsNoExportAccess')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <Field label={t('module.reportsResource')}>
                        <Select value={selectedResource?.resource ?? ''} onChange={(event) => setResource(event.target.value as ReportResource)} aria-label={t('module.reportsResource')}>
                          {availableResources.map((item) => <option key={item.resource} value={item.resource}>{t(item.labelKey)}</option>)}
                        </Select>
                        {selectedResource && <p className="mt-1 text-xs text-ink-faint">{t(selectedResource.descriptionKey)}</p>}
                      </Field>
                      <Field label={t('module.reportsFormat')}>
                        <Select value={format} onChange={(event) => setFormat(event.target.value as ReportFormat)} aria-label={t('module.reportsFormat')}>
                          {REPORT_FORMATS.map((item) => <option key={item} value={item}>{t(`module.reportsFormat.${item}`)}</option>)}
                        </Select>
                      </Field>
                      <Field label={t('module.reportsLimit')} hint={t('module.reportsLimitHint')}>
                        <Input type="number" min={1} max={100000} step={1} value={limit} onChange={(event) => setLimit(event.target.value)} aria-label={t('module.reportsLimit')} />
                      </Field>
                    </div>
                  )}
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

      <footer className="report-print-footer text-xs text-ink-muted" aria-hidden="true">
        {t('module.reportsPrintFooter')} · {printGeneratedAt}
      </footer>
    </div>
  );
}
