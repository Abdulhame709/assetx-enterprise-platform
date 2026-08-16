'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Boxes, CheckCircle2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Download, Eye, FileDown, FileSpreadsheet, Filter, FilterX, ListFilter, Pencil, Plus, Printer, Search, SlidersHorizontal, Trash2, Undo2, UserRound, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommandToolbar } from '@/components/ui/CommandToolbar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useAnalytics, useAssetList } from '@/features/assets/use-assets';
import { AssetDetail, AssetSummary } from '@/features/assets/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { deleteAsset, disposeAsset, downloadAssetExport, getAsset, getCategories } from '@/features/assets/api';
import { getLocationsTree } from '@/features/assets/components/reference-selects';
import { getEmployees, getStatuses, type ReferenceEmployee, type ReferenceStatus } from '@/features/reference/api';
import { AssetFormModal } from '@/features/assets/components/AssetFormModal';
import { AssetBulkEditModal } from '@/features/assets/components/AssetBulkEditModal';
import { formatCurrency } from '@/lib/format';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';

export default function AssetsPage() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([]);
  const [statuses, setStatuses] = useState<ReferenceStatus[]>([]);
  const [employees, setEmployees] = useState<ReferenceEmployee[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'copy'>('create');
  const [formAsset, setFormAsset] = useState<AssetDetail | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [disposing, setDisposing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);
  const { data, status, error, reload } = useAssetList({
    q,
    category_id: category ?? undefined,
    location_id: location ?? undefined,
    status_id: statusId ?? undefined,
    employee_id: employeeId ?? undefined,
    page: 1,
    limit: 60,
  });
  const { data: analytics } = useAnalytics();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { t, locale } = useI18n();

  const formatMessage = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((message, [name, value]) => message.replace(`{${name}}`, String(value)), t(key));
  const metricValue = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString(locale);
  const activeAsset = useMemo(() => data?.items.find((asset) => asset.id === activeId) ?? data?.items[0] ?? null, [activeId, data?.items]);
  const hasActiveFilters = Boolean(q.trim() || category || location || statusId || employeeId);
  const activeIndex = data?.items.findIndex((asset) => asset.id === activeAsset?.id) ?? -1;
  const moveTo = (index: number) => {
    const item = data?.items[index];
    if (!item) return;
    setActiveId(item.id);
    setShowMobileDetail(true);
  };
  const resetWorkspace = () => {
    setQ('');
    setCategory(null);
    setLocation(null);
    setStatusId(null);
    setEmployeeId(null);
    setSelected([]);
    setShowMobileDetail(false);
  };

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
    getLocationsTree().then(setLocations).catch(() => undefined);
    getStatuses().then(setStatuses).catch(() => undefined);
    getEmployees().then(setEmployees).catch(() => undefined);
  }, []);

  useEffect(() => {
    const firstAsset = data?.items[0];
    if (!firstAsset) {
      setActiveId(null);
      return;
    }
    if (!activeId || !data.items.some((asset) => asset.id === activeId)) setActiveId(firstAsset.id);
  }, [activeId, data?.items]);

  const statusName = (id: string | null): string => statuses.find((item) => item.id === id)?.name ?? t('workspace.unknownStatus');
  const statusTone = (id: string | null): BadgeTone => {
    const color = statuses.find((item) => item.id === id)?.color?.toLowerCase();
    if (!color) return 'neutral';
    if (['#27ae60', '#2ecc71'].includes(color)) return 'success';
    if (['#e67e22', '#f39c12'].includes(color)) return 'warning';
    if (['#e74c3c', '#c0392b', '#8e44ad'].includes(color)) return 'danger';
    return 'neutral';
  };

  const onSaved = (asset: AssetDetail, verb: 'created' | 'updated') => {
    toast.success(verb === 'created' ? t('common.assetCreated') : t('assetDetail.updatedToast'), asset.name);
    setFormOpen(false);
    setSelected([]);
    setActiveId(asset.id);
    setShowMobileDetail(true);
    reload();
  };

  const onExport = async (format: 'csv' | 'pdf' = 'csv') => {
    setExporting(true);
    try {
      await downloadAssetExport(format);
      toast.success(t('common.exportDownloaded'), t('common.exportLiveData'));
    } catch (err) {
      toast.error(t('common.exportFailed'), humanError(err));
    } finally {
      setExporting(false);
    }
  };

  const openForm = async (assetId: string, mode: 'edit' | 'copy') => {
    try {
      setFormAsset(await getAsset(assetId));
      setFormMode(mode);
      setFormOpen(true);
    } catch (err) {
      toast.error(t('assetActions.edit'), humanError(err));
    }
  };

  const onDeleteAsset = async (assetId: string) => {
    const approved = await confirm({ title: t('assetActions.deleteTitle'), message: t('assetActions.deleteMessage'), tone: 'danger', confirmLabel: t('assetActions.delete') });
    if (!approved) return;
    setDeleting(true);
    try {
      await deleteAsset(assetId);
      toast.success(t('assetActions.deleteSuccess'), '');
      setSelected((current) => current.filter((id) => id !== assetId));
      reload();
    } catch (err) {
      toast.error(t('assetActions.deleteTitle'), humanError(err));
    } finally {
      setDeleting(false);
    }
  };

  const onDisposeSelected = async () => {
    if (!selected.length) return;
    const approved = await confirm({
      title: formatMessage('assetActions.disposeTitle', { count: selected.length }),
      message: t('assetActions.disposeMessage'), tone: 'danger', confirmLabel: t('assetActions.disposeConfirm'),
    });
    if (!approved) return;
    setDisposing(true);
    const results = await Promise.allSettled(selected.map((id) => disposeAsset(id)));
    setDisposing(false);
    const succeeded = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    if (succeeded) toast.success(t('common.disposalRequestsCreated'), formatMessage('assetActions.disposeSuccessSummary', { count: succeeded }));
    if (failed) toast.error(t('common.someRequestsFailed'), formatMessage('assetActions.disposeFailedSummary', { count: failed }));
    setSelected([]);
    reload();
  };

  const selectAsset = (asset: AssetSummary) => {
    setActiveId(asset.id);
    setShowMobileDetail(true);
  };

  const toggleSelection = (assetId: string) => {
    setSelected((current) => current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('nav.assets')}
        subtitle={formatMessage('assets.subtitle', { count: data?.total ?? 0 })}
      />

      <CommandToolbar
        label={t('assets.commandToolbar')}
        actions={[
          { id: 'first', label: t('assets.firstRecord'), icon: ChevronsRight, onClick: () => moveTo(0), disabled: activeIndex <= 0 },
          { id: 'previous', label: t('assets.previousRecord'), icon: ChevronRight, onClick: () => moveTo(activeIndex - 1), disabled: activeIndex <= 0 },
          { id: 'next', label: t('assets.nextRecord'), icon: ChevronLeft, onClick: () => moveTo(activeIndex + 1), disabled: activeIndex < 0 || activeIndex >= (data?.items.length ?? 0) - 1 },
          { id: 'last', label: t('assets.lastRecord'), icon: ChevronsLeft, onClick: () => moveTo((data?.items.length ?? 1) - 1), disabled: activeIndex < 0 || activeIndex >= (data?.items.length ?? 0) - 1 },
          { id: 'search', label: t('assets.searchCommand'), icon: Search, onClick: () => searchInputRef.current?.focus(), separated: true },
          { id: 'export', label: t('common.export'), icon: Download, onClick: () => void onExport('csv'), permission: PERMISSIONS.EXPORT_ASSETS, loading: exporting },
          { id: 'export-pdf', label: t('common.exportPdf'), icon: FileDown, onClick: () => void onExport('pdf'), permission: PERMISSIONS.EXPORT_ASSETS, loading: exporting },
          { id: 'print', label: t('common.print'), icon: Printer, onClick: () => window.print(), separated: true },
          { id: 'import', label: t('assets.importExcel'), icon: FileSpreadsheet, href: '/import-data', permission: PERMISSIONS.ASSET_CREATE },
          { id: 'preview', label: t('assets.previewCommand'), icon: Eye, onClick: () => setShowMobileDetail(true), disabled: !activeAsset },
          { id: 'add', label: t('assets.addCommand'), icon: Plus, onClick: () => { setFormAsset(null); setFormMode('create'); setFormOpen(true); }, permission: PERMISSIONS.ASSET_CREATE, variant: 'primary' },
          { id: 'copy', label: t('assets.copyCommand'), icon: Copy, onClick: () => activeAsset && void openForm(activeAsset.id, 'copy'), permission: PERMISSIONS.ASSET_CREATE, disabled: !activeAsset },
          { id: 'edit', label: t('assets.editCommand'), icon: Pencil, onClick: () => activeAsset && void openForm(activeAsset.id, 'edit'), permission: PERMISSIONS.ASSET_UPDATE, disabled: !activeAsset },
          { id: 'delete', label: t('assets.deleteCommand'), icon: Trash2, onClick: () => activeAsset && void onDeleteAsset(activeAsset.id), permission: PERMISSIONS.ASSET_DELETE, disabled: !activeAsset, variant: 'danger', separated: true },
          { id: 'undo', label: t('assets.undoCommand'), icon: Undo2, onClick: resetWorkspace, disabled: !hasActiveFilters && selected.length === 0 && !showMobileDetail },
        ]}
      />

      <section aria-label={t('assets.liveMetrics')} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={Boxes} label={t('assets.total')} value={metricValue(analytics?.total_assets ?? data?.total)} tone="brand" />
        <MetricCard icon={CheckCircle2} label={t('assets.active')} value={metricValue(analytics?.active_assets)} tone="success" />
        <MetricCard icon={UserRound} label={t('assets.assigned')} value={metricValue(analytics?.assigned_assets)} tone="warning" />
        <MetricCard icon={Wrench} label={t('assets.maintenance')} value={metricValue(analytics?.maintenance_assets)} tone="danger" />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.9fr)]">
        <section className={`${showMobileDetail ? 'hidden lg:block' : ''} lg:order-2`} aria-label={t('workspace.assetBrowser')}>
          <Card className="h-full overflow-hidden p-0 shadow-card">
            <div className="border-b border-line bg-surface-raised p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Search className="h-4 w-4" /></span>
                  <div>
                    <h2 className="text-sm font-semibold text-ink">{t('workspace.smartSearch')}</h2>
                    <p className="text-xs text-ink-muted">{formatMessage('workspace.assetCount', { count: data?.total ?? 0 })}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowFilters((open) => !open)} aria-expanded={showFilters}>
                  <ListFilter className="h-4 w-4" /> <span className="sr-only sm:not-sr-only">{showFilters ? t('workspace.hideFilters') : t('workspace.showFilters')}</span>
                </Button>
              </div>
              <label className="relative block">
                <span className="sr-only">{t('workspace.smartSearch')}</span>
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input ref={searchInputRef} autoFocus value={q} onChange={(event) => setQ(event.target.value)} placeholder={t('assets.search')} className="ax-input w-full py-2.5 ps-9" />
              </label>
              {showFilters && (
                <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  <SearchableSelect options={categories} value={category} onChange={setCategory} placeholder={t('common.type')} />
                  <SearchableSelect options={locations} value={location} onChange={setLocation} placeholder={t('common.location')} />
                  <SearchableSelect options={statuses.map((item) => ({ value: item.id, label: item.name }))} value={statusId} onChange={setStatusId} placeholder={t('common.status')} />
                  <SearchableSelect options={employees.map((item) => ({ value: item.id, label: item.department ? `${item.name} · ${item.department}` : item.name }))} value={employeeId} onChange={setEmployeeId} placeholder={t('common.custodian')} />
                  {hasActiveFilters && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setCategory(null); setLocation(null); setStatusId(null); setEmployeeId(null); }}><FilterX className="h-3.5 w-3.5" /> {t('assets.clearFilters')}</Button>}
                </div>
              )}
            </div>

            {selected.length > 0 && (
              <div className="flex items-center justify-between gap-2 border-b border-brand/20 bg-brand-soft/45 px-3 py-2">
                <p className="text-xs font-semibold text-ink">{formatMessage('assets.selectedCount', { count: selected.length })}</p>
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>{t('assets.clearSelection')}</Button>
              </div>
            )}

            <div className="max-h-[580px] overflow-y-auto p-2" aria-live="polite">
              {status === 'loading' && <WorkspaceState text={t('common.loading')} />}
              {error && <WorkspaceState text={humanError(error, t('common.genericError'), locale)} retry={reload} />}
              {!error && status !== 'loading' && (data?.items.length ?? 0) === 0 && <WorkspaceState text={t('workspace.noAssetsFound')} />}
              {data?.items.map((asset) => (
                <AssetListItem
                  key={asset.id}
                  asset={asset}
                  active={asset.id === activeAsset?.id}
                  checked={selected.includes(asset.id)}
                  statusName={asset.status_id ? statusName(asset.status_id) : asset.is_active ? t('common.active') : t('common.inactive')}
                  tone={asset.status_id ? statusTone(asset.status_id) : asset.is_active ? 'success' : 'neutral'}
                  onOpen={() => selectAsset(asset)}
                  onToggle={() => toggleSelection(asset.id)}
                />
              ))}
            </div>
          </Card>
        </section>

        <section className={`${showMobileDetail ? '' : 'hidden lg:block'} lg:order-1`} aria-label={t('workspace.assetDetail')}>
          <Card className="min-h-[430px] shadow-card">
            <div className="mb-4 flex items-center justify-between gap-2 lg:hidden">
              <Button variant="ghost" size="sm" onClick={() => setShowMobileDetail(false)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /> {t('workspace.backToList')}</Button>
            </div>
            {activeAsset ? (
              <AssetPreview
                asset={activeAsset}
                statusName={activeAsset.status_id ? statusName(activeAsset.status_id) : activeAsset.is_active ? t('common.active') : t('common.inactive')}
                statusTone={activeAsset.status_id ? statusTone(activeAsset.status_id) : activeAsset.is_active ? 'success' : 'neutral'}
                locale={locale}
                t={t}
                onEdit={() => void openForm(activeAsset.id, 'edit')}
                onCopy={() => void openForm(activeAsset.id, 'copy')}
                onDelete={() => void onDeleteAsset(activeAsset.id)}
                deleting={deleting}
              />
            ) : <WorkspaceState text={t('workspace.selectAsset')} />}
          </Card>
        </section>
      </div>

      {selected.length > 0 && (
        <section className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/25 bg-surface-raised px-4 py-3 shadow-lg" aria-label={t('assets.selectionTitle')}>
          <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white"><SlidersHorizontal className="h-4 w-4" /></span><p className="text-sm font-semibold text-ink">{formatMessage('assets.selectedCount', { count: selected.length })}</p></div>
          <div className="flex flex-wrap gap-2">
            <PermissionGate permission={PERMISSIONS.ASSET_UPDATE}>
              <Button variant="secondary" size="sm" disabled={selected.length !== 1} onClick={() => void openForm(selected[0], 'edit')}><Pencil className="h-3.5 w-3.5" /> {t('assetActions.edit')}</Button>
              <Button variant="secondary" size="sm" disabled={selected.length !== 1} onClick={() => void openForm(selected[0], 'copy')}><Copy className="h-3.5 w-3.5" /> {t('assetActions.copy')}</Button>
              <Button variant="secondary" size="sm" onClick={() => setBulkOpen(true)}><SlidersHorizontal className="h-3.5 w-3.5" /> {t('assetActions.bulkEdit')}</Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.MOVEMENT_CREATE}>
              <Button variant="danger" size="sm" loading={disposing} onClick={() => void onDisposeSelected()}><Archive className="h-3.5 w-3.5" /> {t('common.dispose')}</Button>
            </PermissionGate>
          </div>
        </section>
      )}

      {formOpen && <AssetFormModal open mode={formMode} asset={formAsset} onClose={() => setFormOpen(false)} onSaved={onSaved} />}
      {bulkOpen && <AssetBulkEditModal
        open assetIds={selected} locations={locations}
        employees={employees.map((employee) => ({ value: employee.id, label: employee.department ? `${employee.name} · ${employee.department}` : employee.name }))}
        statuses={statuses.map((item) => ({ value: item.id, label: item.name }))}
        onClose={() => setBulkOpen(false)}
        onSaved={(result) => { toast.success(t(result.failed.length ? 'assetActions.bulkPartial' : 'assetActions.bulkDone'), `${result.updated.length}/${selected.length}`); setSelected([]); reload(); }}
      />}
    </div>
  );
}

function AssetListItem({ asset, active, checked, statusName, tone, onOpen, onToggle }: { asset: AssetSummary; active: boolean; checked: boolean; statusName: string; tone: BadgeTone; onOpen: () => void; onToggle: () => void }) {
  return (
    <div className={`group mb-1 rounded-lg border p-2 transition-colors ${active ? 'border-brand bg-brand-soft/45' : 'border-transparent hover:border-line hover:bg-surface-muted'}`}>
      <div className="flex items-start gap-2">
        <input type="checkbox" aria-label={asset.name} checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 rounded border-line text-brand focus:ring-brand" />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
          <div className="flex items-start justify-between gap-2"><span className="truncate text-sm font-semibold text-ink">{asset.name}</span><Badge tone={tone}>{statusName}</Badge></div>
          <p className="mt-1 truncate text-xs font-medium text-brand">{asset.full_asset_code}</p>
          <p className="mt-1 truncate text-xs text-ink-muted">{asset._locationName ?? '—'} <span className="px-1 text-ink-faint">·</span> {asset.quantity}</p>
        </button>
      </div>
    </div>
  );
}

function AssetPreview({ asset, statusName, statusTone, locale, t, onEdit, onCopy, onDelete, deleting }: { asset: AssetSummary; statusName: string; statusTone: BadgeTone; locale: string; t: (key: string) => string; onEdit: () => void; onCopy: () => void; onDelete: () => void; deleting: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-ink">{asset.name}</h2><Badge tone={statusTone}>{statusName}</Badge></div>
          <p className="mt-2 font-mono text-sm text-brand">{asset.full_asset_code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGate permission={PERMISSIONS.ASSET_UPDATE}><Button variant="secondary" size="sm" onClick={onEdit}><Pencil className="h-4 w-4" /> {t('assetActions.edit')}</Button><Button variant="secondary" size="sm" onClick={onCopy}><Copy className="h-4 w-4" /> {t('assetActions.copy')}</Button></PermissionGate>
          <PermissionGate permission={PERMISSIONS.ASSET_DELETE}><Button variant="ghost" size="sm" loading={deleting} onClick={onDelete}><Trash2 className="h-4 w-4 text-danger" /> <span className="text-danger">{t('assetActions.delete')}</span></Button></PermissionGate>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <PreviewField label={t('common.type')} value={asset._categoryName ?? '—'} />
        <PreviewField label={t('common.location')} value={asset._locationName ?? '—'} />
        <PreviewField label={t('common.custodian')} value={asset._employeeName ?? '—'} />
        <PreviewField label={t('common.quantity')} value={String(asset.quantity)} />
        <PreviewField label={t('common.value')} value={formatCurrency(asset.purchase_price, locale)} />
        <PreviewField label={t('workspace.recordState')} value={asset.is_active ? t('common.active') : t('common.inactive')} />
      </div>
      <div className="mt-6 border-t border-line pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">{t('workspace.moreDetails')}</p>
        <Link href={`/assets/${asset.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline">{t('workspace.openFullRecord')} <ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Link>
      </div>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-surface-muted/60 px-3 py-2.5"><p className="text-xs text-ink-muted">{label}</p><p className="mt-1 truncate text-sm font-semibold text-ink">{value}</p></div>;
}

function WorkspaceState({ text, retry }: { text: string; retry?: () => void }) {
  return <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-4 text-center"><Filter className="h-7 w-7 text-ink-faint" /><p className="max-w-xs text-sm text-ink-muted">{text}</p>{retry && <Button variant="secondary" size="sm" onClick={retry}>إعادة المحاولة</Button>}</div>;
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: string; tone: 'brand' | 'success' | 'warning' | 'danger' }) {
  const toneClass = { brand: 'bg-brand-soft text-brand', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger' }[tone];
  return <div className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4"><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></span><span className="text-2xl font-semibold tabular-nums text-ink">{value}</span></div><p className="mt-3 text-xs font-medium text-ink-muted">{label}</p></div>;
}
