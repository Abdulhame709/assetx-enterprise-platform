
'use client';

import { Activity, Archive, ArrowDown, ArrowUp, BarChart3, BrainCircuit, Check, CircleCheckBig, Columns3, Download, Eye, FolderOpen, Layers3, MapPin, PackageCheck, Plus, Printer, RefreshCw, Save, Trash2, Users, Wrench, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommandToolbar } from '@/components/ui/CommandToolbar';
import { useToast } from '@/components/ui/Toast';
import { useAnalytics } from '@/features/assets/use-assets';
import { downloadReportExport, generateReportAiSummary, ReportAggregation, ReportAiSummary, ReportColumn, ReportDefinition, ReportFormat, ReportGroup, ReportProfileId, ReportResource, ReportSort } from '@/features/reports/api';
import { createReportTemplate, deleteReportTemplate, listReportTemplates, ReportTemplateRecord } from '@/features/reports/templates-api';
import { Field, Input, Select } from '@/components/ui/form';
import { PERMISSIONS, PermissionKey } from '@/lib/auth/permissions';
import { useCan, useSession } from '@/lib/auth/session-context';
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
const REPORT_AGGREGATIONS: ReportAggregation[] = ['count', 'sum', 'avg', 'min', 'max'];

const REPORT_PROFILES: Array<{ value: ReportProfileId; labelKey: string; descriptionKey: string; preferredFormat: ReportFormat }> = [
  { value: 'executive', labelKey: 'module.reportsProfileExecutive', descriptionKey: 'module.reportsProfileExecutiveDesc', preferredFormat: 'pdf' },
  { value: 'finance', labelKey: 'module.reportsProfileFinance', descriptionKey: 'module.reportsProfileFinanceDesc', preferredFormat: 'xlsx' },
  { value: 'auditor', labelKey: 'module.reportsProfileAuditor', descriptionKey: 'module.reportsProfileAuditorDesc', preferredFormat: 'xlsx' },
  { value: 'inventory', labelKey: 'module.reportsProfileInventory', descriptionKey: 'module.reportsProfileInventoryDesc', preferredFormat: 'csv' },
  { value: 'compliance', labelKey: 'module.reportsProfileCompliance', descriptionKey: 'module.reportsProfileComplianceDesc', preferredFormat: 'pdf' },
];

type ReportColumnOption = ReportColumn & { labelKey: string };

const REPORT_COLUMN_CATALOG: Record<ReportResource, ReportColumnOption[]> = {
  assets: [
    { key: 'name', label: '', labelKey: 'module.reportsColumnName', order: 1 },
    { key: 'full_asset_code', label: '', labelKey: 'module.reportsColumnCode', order: 2 },
    { key: 'quantity', label: '', labelKey: 'module.reportsColumnQuantity', order: 3 },
    { key: 'purchase_price', label: '', labelKey: 'module.reportsColumnPurchasePrice', order: 4 },
    { key: 'status_id', label: '', labelKey: 'module.reportsColumnStatus', order: 5 },
    { key: 'location_id', label: '', labelKey: 'module.reportsColumnLocation', order: 6 },
    { key: 'employee_id', label: '', labelKey: 'module.reportsColumnEmployee', order: 7 },
    { key: 'serial_number', label: '', labelKey: 'module.reportsColumnSerial', order: 8 },
    { key: 'barcode', label: '', labelKey: 'module.reportsColumnBarcode', order: 9 },
    { key: 'purchase_date', label: '', labelKey: 'module.reportsColumnPurchaseDate', order: 10 },
    { key: 'is_active', label: '', labelKey: 'module.reportsColumnActive', order: 11 },
  ],
  movements: [
    { key: 'id', label: '', labelKey: 'module.reportsColumnId', order: 1 },
    { key: 'asset_id', label: '', labelKey: 'module.reportsColumnAssetId', order: 2 },
    { key: 'movement_type', label: '', labelKey: 'module.reportsColumnMovementType', order: 3 },
    { key: 'status', label: '', labelKey: 'module.reportsColumnStatus', order: 4 },
    { key: 'from_location_id', label: '', labelKey: 'module.reportsColumnFromLocation', order: 5 },
    { key: 'to_location_id', label: '', labelKey: 'module.reportsColumnToLocation', order: 6 },
    { key: 'created_at', label: '', labelKey: 'module.reportsColumnCreatedAt', order: 7 },
    { key: 'reason', label: '', labelKey: 'module.reportsColumnReason', order: 8 },
  ],
  inventory: [
    { key: 'record_id', label: '', labelKey: 'module.reportsColumnRecordId', order: 1 },
    { key: 'cycle_id', label: '', labelKey: 'module.reportsColumnCycleId', order: 2 },
    { key: 'asset_id', label: '', labelKey: 'module.reportsColumnAssetId', order: 3 },
    { key: 'expected_quantity', label: '', labelKey: 'module.reportsColumnExpectedQuantity', order: 4 },
    { key: 'actual_quantity', label: '', labelKey: 'module.reportsColumnActualQuantity', order: 5 },
    { key: 'result', label: '', labelKey: 'module.reportsColumnInventoryResult', order: 6 },
    { key: 'inventory_date', label: '', labelKey: 'module.reportsColumnInventoryDate', order: 7 },
    { key: 'notes', label: '', labelKey: 'module.reportsColumnNotes', order: 8 },
  ],
  audit: [
    { key: 'id', label: '', labelKey: 'module.reportsColumnId', order: 1 },
    { key: 'action_type', label: '', labelKey: 'module.reportsColumnAction', order: 2 },
    { key: 'entity', label: '', labelKey: 'module.reportsColumnEntity', order: 3 },
    { key: 'entity_id', label: '', labelKey: 'module.reportsColumnEntityId', order: 4 },
    { key: 'user_id', label: '', labelKey: 'module.reportsColumnUserId', order: 5 },
    { key: 'created_at', label: '', labelKey: 'module.reportsColumnCreatedAt', order: 6 },
    { key: 'metadata', label: '', labelKey: 'module.reportsColumnMetadata', order: 7 },
  ],
  dashboard: [
    { key: 'metric', label: '', labelKey: 'module.reportsColumnMetric', order: 1 },
    { key: 'value', label: '', labelKey: 'module.reportsColumnValue', order: 2 },
  ],
};

const REPORT_LAYOUT_STORAGE_KEY = 'assetx.report.layout.v1';

const PROFILE_COLUMN_KEYS: Record<ReportProfileId, string[]> = {
  executive: ['name', 'full_asset_code', 'quantity', 'purchase_price', 'is_active'],
  finance: ['name', 'full_asset_code', 'purchase_price', 'purchase_date'],
  auditor: ['full_asset_code', 'name', 'status_id', 'location_id', 'employee_id', 'serial_number', 'barcode'],
  inventory: ['full_asset_code', 'name', 'quantity', 'location_id', 'serial_number', 'barcode'],
  compliance: ['full_asset_code', 'name', 'barcode', 'status_id', 'employee_id', 'location_id'],
};

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
  const { session } = useSession();
  const [resource, setResource] = useState<ReportResource>('assets');
  const [format, setFormat] = useState<ReportFormat>('csv');
  const [limit, setLimit] = useState('10000');
  const [profile, setProfile] = useState<ReportProfileId | ''>('');
  const [selectedColumns, setSelectedColumns] = useState<ReportColumn[]>([]);
  const [sorting, setSorting] = useState<ReportSort[]>([]);
  const [grouping, setGrouping] = useState<ReportGroup[]>([]);
  const [templates, setTemplates] = useState<ReportTemplateRecord[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateShared, setTemplateShared] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateDeleting, setTemplateDeleting] = useState<string | null>(null);
  const [showDesigner, setShowDesigner] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [aiSummary, setAiSummary] = useState<ReportAiSummary | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const availableResources = useMemo(() => REPORT_RESOURCES.filter((item) => can(item.permission)), [can]);
  const selectedResource = availableResources.find((item) => item.resource === resource) ?? availableResources[0] ?? null;
  const columnCatalog = REPORT_COLUMN_CATALOG[resource];
  const selectedProfile = REPORT_PROFILES.find((item) => item.value === profile) ?? null;
  const canCreateTemplates = can(PERMISSIONS.REPORT_CREATE);
  const canDeleteTemplates = can(PERMISSIONS.REPORT_DELETE);
  const canUseAi = can(PERMISSIONS.REPORT_VIEW) && can(PERMISSIONS.AI_USE);
  const aiResourceSupported = resource === 'assets' || resource === 'dashboard';
  const printGeneratedAt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  useEffect(() => {
    if (selectedResource && selectedResource.resource !== resource) setResource(selectedResource.resource);
  }, [resource, selectedResource]);

  useEffect(() => {
    setAiSummary(null);
  }, [resource]);

  useEffect(() => {
    let active = true;
    setTemplatesLoading(true);
    void listReportTemplates(resource)
      .then((items) => { if (active) setTemplates(items); })
      .catch(() => { if (active) setTemplates([]); })
      .finally(() => { if (active) setTemplatesLoading(false); });
    return () => { active = false; };
  }, [resource]);

  useEffect(() => {
    const defaults = columnCatalog.slice(0, Math.min(columnCatalog.length, 8)).map((column) => ({ key: column.key, label: t(column.labelKey), order: column.order }));
    setSelectedColumns((current) => {
      const allowed = new Set(columnCatalog.map((column) => column.key));
      const retained = current.filter((column) => allowed.has(column.key));
      return retained.length > 0
        ? retained.map((column, index) => ({ ...column, label: t(columnCatalog.find((option) => option.key === column.key)?.labelKey ?? '', column.label), order: index + 1 }))
        : defaults;
    });
    setProfile('');
  }, [columnCatalog, resource, t]);

  const toggleColumn = (option: ReportColumnOption) => {
    setProfile('');
    setSelectedColumns((current) => {
      const existing = current.findIndex((column) => column.key === option.key);
      if (existing >= 0) return current.filter((column) => column.key !== option.key).map((column, index) => ({ ...column, order: index + 1 }));
      return [...current, { key: option.key, label: t(option.labelKey), order: current.length + 1 }];
    });
  };

  const moveColumn = (index: number, direction: -1 | 1) => {
    setProfile('');
    setSelectedColumns((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((column, order) => ({ ...column, order: order + 1 }));
    });
  };

  const saveLayout = () => {
    try {
      localStorage.setItem(`${REPORT_LAYOUT_STORAGE_KEY}.${resource}`, JSON.stringify({ profile, columns: selectedColumns, format, limit, sorting, grouping }));
      toast.success(t('module.reportsLayoutSaved'), t('module.reportsLayoutSavedMessage'));
    } catch (error) {
      toast.error(t('module.reportsLayoutFailed'), humanError(error));
    }
  };

  const restoreLayout = () => {
    try {
      const raw = localStorage.getItem(`${REPORT_LAYOUT_STORAGE_KEY}.${resource}`);
      if (!raw) {
        toast.error(t('module.reportsLayoutFailed'), t('module.reportsNoSavedLayout'));
        return;
      }
      const parsed = JSON.parse(raw) as { profile?: ReportProfileId; columns?: ReportColumn[]; format?: ReportFormat; limit?: string; sorting?: ReportSort[]; grouping?: ReportGroup[] };
      const allowed = new Set(columnCatalog.map((column) => column.key));
      const restored = Array.isArray(parsed.columns)
        ? parsed.columns.filter((column) => column && allowed.has(column.key)).map((column, index) => ({ key: column.key, label: t(columnCatalog.find((item) => item.key === column.key)?.labelKey ?? '', column.label), order: index + 1 }))
        : [];
      if (restored.length > 0) setSelectedColumns(restored);
      setProfile(parsed.profile && REPORT_PROFILES.some((item) => item.value === parsed.profile) ? parsed.profile : '');
      if (parsed.format && REPORT_FORMATS.includes(parsed.format)) setFormat(parsed.format);
      if (parsed.limit) setLimit(parsed.limit);
      if (Array.isArray(parsed.sorting)) setSorting(parsed.sorting.filter((item) => item && typeof item.field === 'string' && (item.dir === 'asc' || item.dir === 'desc')));
      if (Array.isArray(parsed.grouping)) setGrouping(parsed.grouping.filter((item) => item && typeof item.field === 'string' && REPORT_AGGREGATIONS.includes(item.aggregate ?? 'count')));
      toast.success(t('module.reportsLayoutLoaded'), t('module.reportsLayoutLoadedMessage'));
    } catch (error) {
      toast.error(t('module.reportsLayoutFailed'), humanError(error));
    }
  };

  const applyProfile = (nextProfile: ReportProfileId | '') => {
    setProfile(nextProfile);
    if (!nextProfile) return;
    const keys = new Set(PROFILE_COLUMN_KEYS[nextProfile]);
    const selected = columnCatalog.filter((column) => keys.has(column.key)).map((column, index) => ({ key: column.key, label: t(column.labelKey), order: index + 1 }));
    setSelectedColumns(selected.length > 0 ? selected : columnCatalog.slice(0, 6).map((column, index) => ({ key: column.key, label: t(column.labelKey), order: index + 1 })));
    const preference = REPORT_PROFILES.find((item) => item.value === nextProfile);
    if (preference) setFormat(preference.preferredFormat);
  };

  const addSorting = () => {
    const field = selectedColumns[0]?.key ?? columnCatalog[0]?.key;
    if (!field) return;
    setSorting((current) => [...current, { field, dir: 'asc' }]);
  };

  const updateSorting = (index: number, patch: Partial<ReportSort>) => {
    setSorting((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const addGrouping = () => {
    const field = selectedColumns[0]?.key ?? columnCatalog[0]?.key;
    if (!field) return;
    setGrouping((current) => [...current, { field, aggregate: 'count' }]);
  };

  const updateGrouping = (index: number, patch: Partial<ReportGroup>) => {
    setGrouping((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const currentDefinition = (name: string): ReportDefinition => ({
    id: `designer-${resource}-${Date.now()}`,
    name,
    resource,
    format,
    columns: selectedColumns.map((column) => ({ field: column.key, label: column.label })),
    sorting,
    grouping,
  });

  const loadTemplate = (template: ReportTemplateRecord) => {
    const definition = template.definition;
    const catalog = REPORT_COLUMN_CATALOG[definition.resource];
    const restoredColumns = definition.columns
      .filter((column) => catalog.some((option) => option.key === column.field))
      .map((column, index) => ({ key: column.field, label: t(catalog.find((option) => option.key === column.field)?.labelKey ?? '', column.label ?? column.field), order: index + 1 }));
    setResource(definition.resource);
    setFormat(definition.format);
    setProfile('');
    setSelectedColumns(restoredColumns.length > 0 ? restoredColumns : catalog.slice(0, 8).map((column, index) => ({ key: column.key, label: t(column.labelKey), order: index + 1 })));
    setSorting(definition.sorting ?? []);
    setGrouping(definition.grouping ?? []);
    toast.success(t('module.reportsTemplateLoaded'), t('module.reportsTemplateLoadedMessage'));
  };

  const saveTemplate = async () => {
    const name = templateName.trim();
    if (!canCreateTemplates) return;
    if (!name) {
      toast.error(t('module.reportsTemplateSaveFailed'), t('module.reportsTemplateNameInvalid'));
      return;
    }
    setTemplateSaving(true);
    try {
      const created = await createReportTemplate({
        name,
        description: templateDescription.trim() || undefined,
        resource,
        format,
        definition: currentDefinition(name),
        is_shared: templateShared,
      });
      setTemplates((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setTemplateName('');
      setTemplateDescription('');
      setTemplateShared(false);
      toast.success(t('module.reportsTemplateSaved'), t('module.reportsTemplateSavedMessage'));
    } catch (error) {
      toast.error(t('module.reportsTemplateSaveFailed'), humanError(error));
    } finally {
      setTemplateSaving(false);
    }
  };

  const removeTemplate = async (template: ReportTemplateRecord) => {
    if (!canDeleteTemplates || template.created_by !== session?.user.id) return;
    if (!window.confirm(`${t('module.reportsDeleteTemplate')}: ${template.name}?`)) return;
    setTemplateDeleting(template.id);
    try {
      await deleteReportTemplate(template.id);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      toast.success(t('module.reportsTemplateDeleted'));
    } catch (error) {
      toast.error(t('module.reportsTemplateDeleteFailed'), humanError(error));
    } finally {
      setTemplateDeleting(null);
    }
  };

  const generateAiSummary = async () => {
    if (!canUseAi || !aiResourceSupported) return;
    setAiGenerating(true);
    try {
      const result = await generateReportAiSummary(resource as 'assets' | 'dashboard');
      setAiSummary(result);
      toast.success(t('module.reportsAiTitle'), result.source === 'llm' ? t('module.reportsAiLlm') : t('module.reportsAiDeterministic'));
    } catch (error) {
      toast.error(t('module.reportsAiFailed'), humanError(error));
    } finally {
      setAiGenerating(false);
    }
  };

  const download = async () => {
    if (!selectedResource) return;
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100000) {
      toast.error(t('module.reportsExportFailed'), t('module.reportsLimitInvalid'));
      return;
    }
    setExporting(true);
    try {
      await downloadReportExport({ resource: selectedResource.resource, format, limit: parsedLimit, profile: profile || undefined, columns: selectedColumns, sorting, grouping });
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
          { id: 'ai-summary', label: t('module.reportsAiGenerate'), icon: BrainCircuit, onClick: () => void generateAiSummary(), loading: aiGenerating, disabled: !canUseAi || !aiResourceSupported, separated: true },
          { id: 'print', label: t('common.print'), icon: Printer, onClick: () => window.print(), separated: true },
          { id: 'designer', label: showDesigner ? t('module.reportsDesignerHide') : t('module.reportsDesignerShow'), icon: Columns3, onClick: () => setShowDesigner((visible) => !visible), separated: true },
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
        <div className="mt-3 border-t border-line pt-3 text-sm">
          <span className="font-semibold text-ink">{t('module.reportsProfile')}:</span> {selectedProfile ? t(selectedProfile.labelKey) : t('module.reportsNoProfile')}
          <span className="mx-2 text-ink-faint">·</span>
          <span className="font-semibold text-ink">{t('module.reportsSelectedColumns')}:</span> {selectedColumns.map((column) => column.label).join(' · ')}
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

              <Card className="border-brand/20 bg-gradient-to-br from-violet-500/10 via-surface to-surface print-hide" aria-live="polite">
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="rounded-xl bg-violet-500/10 p-2.5 text-violet-600"><BrainCircuit className="h-5 w-5" aria-hidden="true" /></span>
                      <div>
                        <p className="font-semibold text-ink">{t('module.reportsAiTitle')}</p>
                        <p className="mt-1 text-sm text-ink-muted">{t('module.reportsAiDescription')}</p>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => void generateAiSummary()} loading={aiGenerating} disabled={!canUseAi || !aiResourceSupported} title={!canUseAi ? t('module.reportsAiDisabled') : undefined}>
                      <BrainCircuit className="h-4 w-4" />
                      {aiGenerating ? t('module.reportsAiGenerating') : t('module.reportsAiGenerate')}
                    </Button>
                  </div>
                  {!canUseAi ? (
                    <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-muted">{t('module.reportsAiDisabled')}</p>
                  ) : !aiResourceSupported ? (
                    <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-muted">{t('module.reportsAiUnavailable')}</p>
                  ) : aiSummary ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-violet-700">{aiSummary.source === 'llm' ? t('module.reportsAiLlm') : t('module.reportsAiDeterministic')}</span>
                          <span className="text-xs text-ink-muted">{t('module.reportsAiConfidence')}: {Math.round(aiSummary.confidence * 100).toLocaleString(locale)}%</span>
                        </div>
                        <p className="text-sm leading-7 text-ink">{aiSummary.summary}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div><p className="mb-2 text-xs font-semibold text-ink">{t('module.reportsAiFindings')}</p><ul className="space-y-1 text-sm text-ink-muted">{aiSummary.key_findings.map((item, index) => <li key={`finding-${index}`} className="rounded-lg bg-surface-muted/50 px-2 py-1.5">{item}</li>)}</ul></div>
                        <div><p className="mb-2 text-xs font-semibold text-ink">{t('module.reportsAiWarnings')}</p><ul className="space-y-1 text-sm text-ink-muted">{aiSummary.warnings.length > 0 ? aiSummary.warnings.map((item, index) => <li key={`warning-${index}`} className="rounded-lg bg-warning/10 px-2 py-1.5">{item}</li>) : <li className="rounded-lg bg-surface-muted/50 px-2 py-1.5">—</li>}</ul></div>
                        <div><p className="mb-2 text-xs font-semibold text-ink">{t('module.reportsAiEvidence')}</p><ul className="space-y-1 text-xs text-ink-muted">{aiSummary.evidence.map((item, index) => <li key={`evidence-${index}`} className="rounded-lg bg-surface-muted/50 px-2 py-1.5 font-mono">{item}</li>)}</ul></div>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-ink-muted">{t('module.reportsAiUnavailable')}</p>
                  )}
                </CardBody>
              </Card>

              {showDesigner && availableResources.length > 0 && (
                <Card className="border-brand/15 bg-surface print-hide">
                  <CardHeader
                    title={t('module.reportsDesignerTitle')}
                    subtitle={t('module.reportsDesignerDesc')}
                    actions={<Columns3 className="h-4 w-4 text-brand" aria-hidden="true" />}
                  />
                  <CardBody className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Field label={t('module.reportsProfile')} hint={selectedProfile ? t(selectedProfile.descriptionKey) : t('module.reportsProfileHint')}>
                        <Select value={profile} onChange={(event) => applyProfile(event.target.value as ReportProfileId | '')} aria-label={t('module.reportsProfile')}>
                          <option value="">{t('module.reportsNoProfile')}</option>
                          {REPORT_PROFILES.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
                        </Select>
                      </Field>
                      <div className="rounded-lg border border-line bg-surface-muted/30 px-3 py-2 text-sm text-ink-muted">
                        <p className="font-medium text-ink">{t('module.reportsSelectedColumns')}: {selectedColumns.length}</p>
                        <p className="mt-1 text-xs">{t('module.reportsColumnsHint')}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 md:col-span-2">
                        <Button variant="secondary" size="sm" onClick={saveLayout} title={t('module.reportsSaveLayout')} aria-label={t('module.reportsSaveLayout')}><Save className="h-4 w-4" />{t('module.reportsSaveLayout')}</Button>
                        <Button variant="ghost" size="sm" onClick={restoreLayout} title={t('module.reportsLoadLayout')} aria-label={t('module.reportsLoadLayout')}><FolderOpen className="h-4 w-4" />{t('module.reportsLoadLayout')}</Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="rounded-xl border border-line bg-surface-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">{t('module.reportsAvailableColumns')}</p>
                          <span className="text-xs text-ink-muted">{columnCatalog.length}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                          {columnCatalog.map((option) => {
                            const isSelected = selectedColumns.some((column) => column.key === option.key);
                            return (
                              <button
                                key={option.key}
                                type="button"
                                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-start text-sm transition-colors ${isSelected ? 'border-brand/40 bg-brand/10 text-brand' : 'border-line bg-surface hover:bg-surface-muted'}`}
                                onClick={() => toggleColumn(option)}
                                aria-pressed={isSelected}
                              >
                                {isSelected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Columns3 className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />}
                                <span className="truncate">{t(option.labelKey)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="rounded-xl border border-line bg-surface-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">{t('module.reportsColumnOrder')}</p>
                          <span className="text-xs text-ink-muted">{t('module.reportsColumnOrderHint')}</span>
                        </div>
                        {selectedColumns.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-line px-3 py-5 text-center text-sm text-ink-muted">{t('module.reportsNoColumns')}</p>
                        ) : (
                          <div className="space-y-1">
                            {selectedColumns.map((column, index) => (
                              <div key={column.key} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5">
                                <span className="w-6 text-center text-xs font-semibold text-ink-muted">{index + 1}</span>
                                <span className="min-w-0 flex-1 truncate text-sm text-ink">{column.label}</span>
                                <Button variant="ghost" size="sm" disabled={index === 0} title={t('module.reportsMoveColumnUp')} aria-label={t('module.reportsMoveColumnUp')} onClick={() => moveColumn(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="sm" disabled={index === selectedColumns.length - 1} title={t('module.reportsMoveColumnDown')} aria-label={t('module.reportsMoveColumnDown')} onClick={() => moveColumn(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="sm" title={t('module.reportsRemoveColumn')} aria-label={t('module.reportsRemoveColumn')} onClick={() => toggleColumn({ ...column, labelKey: '' })}><X className="h-3.5 w-3.5 text-danger" /></Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="rounded-xl border border-line bg-surface-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">{t('module.reportsSorting')}</p>
                          <Button variant="ghost" size="sm" onClick={addSorting} title={t('module.reportsAddSorting')} aria-label={t('module.reportsAddSorting')}><Plus className="h-4 w-4" /></Button>
                        </div>
                        {sorting.length === 0 ? <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-muted">{t('module.reportsNoSorting')}</p> : (
                          <div className="space-y-2">
                            {sorting.map((rule, index) => (
                              <div key={`${rule.field}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                                <Select value={rule.field} onChange={(event) => updateSorting(index, { field: event.target.value })} aria-label={t('module.reportsSortField')}>
                                  {columnCatalog.map((option) => <option key={option.key} value={option.key}>{t(option.labelKey)}</option>)}
                                </Select>
                                <Select value={rule.dir} onChange={(event) => updateSorting(index, { dir: event.target.value as ReportSort['dir'] })} aria-label={t('module.reportsDirection')}>
                                  <option value="asc">{t('module.reportsAscending')}</option>
                                  <option value="desc">{t('module.reportsDescending')}</option>
                                </Select>
                                <Button variant="ghost" size="sm" onClick={() => setSorting((current) => current.filter((_, itemIndex) => itemIndex !== index))} title={t('module.reportsRemoveColumn')} aria-label={t('module.reportsRemoveColumn')}><Trash2 className="h-3.5 w-3.5 text-danger" /></Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-line bg-surface-muted/20 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink">{t('module.reportsGrouping')}</p>
                          <Button variant="ghost" size="sm" onClick={addGrouping} title={t('module.reportsAddGrouping')} aria-label={t('module.reportsAddGrouping')}><Plus className="h-4 w-4" /></Button>
                        </div>
                        {grouping.length === 0 ? <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-muted">{t('module.reportsNoGrouping')}</p> : (
                          <div className="space-y-2">
                            {grouping.map((rule, index) => (
                              <div key={`${rule.field}-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                                <Select value={rule.field} onChange={(event) => updateGrouping(index, { field: event.target.value })} aria-label={t('module.reportsGroupField')}>
                                  {columnCatalog.map((option) => <option key={option.key} value={option.key}>{t(option.labelKey)}</option>)}
                                </Select>
                                <Select value={rule.aggregate ?? 'count'} onChange={(event) => { const aggregate = event.target.value as ReportAggregation; updateGrouping(index, { aggregate, valueField: aggregate === 'count' ? undefined : rule.valueField }); }} aria-label={t('module.reportsAggregate')}>
                                  {REPORT_AGGREGATIONS.map((aggregate) => <option key={aggregate} value={aggregate}>{t(`module.reportsAggregation.${aggregate}`)}</option>)}
                                </Select>
                                <Select value={rule.valueField ?? ''} disabled={(rule.aggregate ?? 'count') === 'count'} onChange={(event) => updateGrouping(index, { valueField: event.target.value || undefined })} aria-label={t('module.reportsValueField')}>
                                  <option value="">{t('module.reportsValueField')}</option>
                                  {columnCatalog.map((option) => <option key={option.key} value={option.key}>{t(option.labelKey)}</option>)}
                                </Select>
                                <Button variant="ghost" size="sm" onClick={() => setGrouping((current) => current.filter((_, itemIndex) => itemIndex !== index))} title={t('module.reportsRemoveColumn')} aria-label={t('module.reportsRemoveColumn')}><Trash2 className="h-3.5 w-3.5 text-danger" /></Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-brand-soft/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{t('module.reportsTemplates')}</p>
                          <p className="mt-1 text-xs text-ink-muted">{t('module.reportsTemplateSharedHint')}</p>
                        </div>
                        {templates.length > 0 && <span className="text-xs text-ink-muted">{templates.length}</span>}
                      </div>
                      {canCreateTemplates && (
                        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                          <Field label={t('module.reportsTemplateName')}>
                            <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} aria-label={t('module.reportsTemplateName')} />
                          </Field>
                          <Field label={t('module.reportsTemplateDescription')}>
                            <Input value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} aria-label={t('module.reportsTemplateDescription')} />
                          </Field>
                          <label className="flex items-center gap-2 self-end rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
                            <input type="checkbox" checked={templateShared} onChange={(event) => setTemplateShared(event.target.checked)} />
                            <span>{t('module.reportsTemplateShared')}</span>
                          </label>
                          <Button variant="primary" size="sm" className="self-end" loading={templateSaving} onClick={() => void saveTemplate()}><Save className="h-4 w-4" />{t('module.reportsSaveTemplate')}</Button>
                        </div>
                      )}
                      <div className="mt-3 space-y-2">
                        {templatesLoading ? <p className="text-xs text-ink-muted">{t('common.loading')}</p> : templates.length === 0 ? <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-ink-muted">{t('module.reportsNoTemplates')}</p> : templates.map((template) => (
                          <div key={template.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-ink">{template.name}{template.is_shared ? <span className="ms-2 text-xs font-normal text-brand">· {t('module.reportsTemplateShared')}</span> : null}</p>
                              {template.description && <p className="truncate text-xs text-ink-muted">{template.description}</p>}
                            </div>
                            <Button variant="secondary" size="sm" onClick={() => loadTemplate(template)} title={t('module.reportsLoadTemplate')} aria-label={t('module.reportsLoadTemplate')}><FolderOpen className="h-4 w-4" />{t('module.reportsLoadTemplate')}</Button>
                            {canDeleteTemplates && template.created_by === session?.user.id && <Button variant="ghost" size="sm" loading={templateDeleting === template.id} onClick={() => void removeTemplate(template)} title={t('module.reportsDeleteTemplate')} aria-label={t('module.reportsDeleteTemplate')}><Trash2 className="h-4 w-4 text-danger" /></Button>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

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
