'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Archive, Boxes, CheckCircle2, Copy, Download, FilterX, Pencil, Plus, Search, SlidersHorizontal, Trash2, UserRound, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EnterpriseTable, EColumn } from '@/components/ui/EnterpriseTable';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useAnalytics, useAssetList } from '@/features/assets/use-assets';
import { AssetSummary } from '@/features/assets/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { deleteAsset, disposeAsset, downloadAssetExport, getAsset, getCategories, type AssetDetail } from '@/features/assets/api';
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
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('full_asset_code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<string[]>([]);
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
  const [deleting, setDeleting] = useState(false);
  const { data, status, error, reload } = useAssetList({
    q, category_id: category ?? undefined, location_id: location ?? undefined,
    status_id: statusId ?? undefined, page, limit: 20,
  });
  const { data: analytics } = useAnalytics();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { t, locale } = useI18n();

  const formatMessage = (key: string, values: Record<string, string | number>) =>
    Object.entries(values).reduce((message, [name, value]) => message.replace(`{${name}}`, String(value)), t(key));
  const metricValue = (value: number | undefined) => value === undefined ? '—' : value.toLocaleString(locale);
  const hasActiveFilters = Boolean(q.trim() || category || location || statusId);
  const displayedCount = data?.items.length ?? 0;

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
    getLocationsTree().then(setLocations).catch(() => undefined);
    getStatuses().then(setStatuses).catch(() => undefined);
    getEmployees().then(setEmployees).catch(() => undefined);
  }, []);

  const statusName = (id: string | null): string => statuses.find((s) => s.id === id)?.name ?? '—';
  const statusTone = (id: string | null): BadgeTone => {
    const color = statuses.find((s) => s.id === id)?.color?.toLowerCase();
    if (!color) return 'neutral';
    if (['#27ae60', '#2ecc71'].includes(color)) return 'success';
    if (['#e67e22', '#f39c12'].includes(color)) return 'warning';
    if (['#e74c3c', '#c0392b', '#8e44ad'].includes(color)) return 'danger';
    return 'neutral';
  };

  const columns: EColumn<AssetSummary>[] = [
    { key: 'full_asset_code', header: t('common.code'), width: '150px', sortable: true },
    { key: 'name', header: t('common.name'), sortable: true, render: (row) => (
      <Link href={`/assets/${row.id}`} className="font-medium text-brand hover:underline">{row.name}</Link>
    ) },
    { key: 'location_id', header: t('common.location'), render: (row) => row._locationName ?? '—' },
    { key: 'employee_id', header: t('common.custodian'), render: (row) => row._employeeName ?? '—' },
    { key: 'status_id', header: t('common.status'), render: (row) =>
      row.status_id ? <Badge tone={statusTone(row.status_id)}>{statusName(row.status_id)}</Badge> :
        <Badge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? t('common.active') : t('common.inactive')}</Badge> },
    { key: 'quantity', header: t('common.quantity'), align: 'center', render: (row) => <span className="text-ink-muted">{row.quantity}</span> },
    { key: 'purchase_price', header: t('common.value'), align: 'right', sortable: true, accessor: (row) => Number(row.purchase_price || 0), render: (row) => formatCurrency(row.purchase_price) },
  ];

  const onSaved = (asset: AssetDetail, verb: 'created' | 'updated') => {
    toast.success(verb === 'created' ? t('common.assetCreated') : t('assetDetail.updatedToast'), asset.name);
    setSelected([]);
    reload();
  };

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadAssetExport('csv');
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

  const openFormForSelected = async (mode: 'edit' | 'copy') => {
    if (selected.length !== 1) return;
    await openForm(selected[0], mode);
  };

  const onDeleteAsset = async (assetId: string) => {
    const approved = await confirm({
      title: t('assetActions.deleteTitle'), message: t('assetActions.deleteMessage'),
      tone: 'danger', confirmLabel: t('assetActions.delete'),
    });
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

  const onDeleteSelected = async () => {
    if (selected.length !== 1) return;
    await onDeleteAsset(selected[0]);
  };

  const onDisposeSelected = async () => {
    if (selected.length === 0) return;
    const approved = await confirm({
      title: formatMessage('assetActions.disposeTitle', { count: selected.length }),
      message: t('assetActions.disposeMessage'),
      tone: 'danger', confirmLabel: t('assetActions.disposeConfirm'),
    });
    if (!approved) return;
    setDisposing(true);
    const results = await Promise.allSettled(selected.map((id) => disposeAsset(id)));
    setDisposing(false);
    const succeeded = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    if (succeeded > 0) toast.success(t('common.disposalRequestsCreated'), formatMessage('assetActions.disposeSuccessSummary', { count: succeeded }));
    if (failed > 0) {
      const firstError = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      toast.error(t('common.someRequestsFailed'), failed === 1 ? humanError(firstError?.reason) : formatMessage('assetActions.disposeFailedSummary', { count: failed }));
    }
    setSelected([]);
    reload();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('nav.assets')}
        subtitle={formatMessage('assets.subtitle', { count: data?.total ?? 0 })}
        actions={<div className="flex items-center gap-2">
          <PermissionGate permission={PERMISSIONS.EXPORT_ASSETS}>
            <Button variant="secondary" size="sm" onClick={() => void onExport()} loading={exporting}><Download className="h-4 w-4" /> {t('common.export')}</Button>
          </PermissionGate>
          <PermissionGate permission={PERMISSIONS.ASSET_CREATE}>
            <Button variant="primary" size="sm" onClick={() => { setFormAsset(null); setFormMode('create'); setFormOpen(true); }}><Plus className="h-4 w-4" /> {t('common.newAsset')}</Button>
          </PermissionGate>
        </div>}
      />

      <section aria-label={t('assets.liveMetrics')} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={Boxes} label={t('assets.total')} value={metricValue(analytics?.total_assets ?? data?.total)} tone="brand" />
        <MetricCard icon={CheckCircle2} label={t('assets.active')} value={metricValue(analytics?.active_assets)} tone="success" />
        <MetricCard icon={UserRound} label={t('assets.assigned')} value={metricValue(analytics?.assigned_assets)} tone="warning" />
        <MetricCard icon={Wrench} label={t('assets.maintenance')} value={metricValue(analytics?.maintenance_assets)} tone="danger" />
      </section>

      <section className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4" aria-labelledby="asset-controls-title">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><SlidersHorizontal className="h-4 w-4" /></span>
            <div>
              <h2 id="asset-controls-title" className="text-sm font-semibold text-ink">{t('assets.controlsTitle')}</h2>
              <p className="text-xs text-ink-muted">{formatMessage('assets.resultsSummary', { shown: displayedCount, total: data?.total ?? 0 })}</p>
            </div>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(''); setCategory(null); setLocation(null); setStatusId(null); setPage(1); }}>
              <FilterX className="h-3.5 w-3.5" /> {t('assets.clearFilters')}
            </Button>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1.8fr)_repeat(3,minmax(150px,1fr))]">
          <label className="relative block">
            <span className="sr-only">{t('assets.search')}</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder={t('assets.search')} className="ax-input w-full py-2 ps-9" />
          </label>
          <SearchableSelect options={categories} value={category} onChange={(value) => { setCategory(value); setPage(1); }} placeholder={t('common.type')} />
          <SearchableSelect options={locations} value={location} onChange={(value) => { setLocation(value); setPage(1); }} placeholder={t('common.location')} />
          <SearchableSelect options={statuses.map((item) => ({ value: item.id, label: item.name }))} value={statusId} onChange={(value) => { setStatusId(value); setPage(1); }} placeholder={t('common.status')} />
        </div>
      </section>

      {selected.length > 0 && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/25 bg-brand-soft/45 px-4 py-3" aria-label={t('assets.selectionTitle')}>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white"><CheckCircle2 className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-semibold text-ink">{formatMessage('assets.selectedCount', { count: selected.length })}</p>
              <p className="text-xs text-ink-muted">{t('assets.selectionHint')}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>{t('assets.clearSelection')}</Button>
        </section>
      )}

      <Card className="overflow-hidden p-0 shadow-card"><CardBody className="p-0">
        <EnterpriseTable
          columns={columns} rows={data?.items ?? []} rowKey={(row) => row.id}
          loading={status === 'loading'} error={error ? humanError(error, t('common.genericError'), locale) : null} onRetry={reload}
          page={page} pageSize={20} total={data?.total ?? 0} onPageChange={setPage}
          sortKey={sortKey} sortDir={sortDir} onSortChange={(key, direction) => { setSortKey(key); setSortDir(direction); }}
          selectable selectedKeys={selected} onSelectionChange={setSelected} defaultHiddenColumns={['quantity']}
          toolbarActions={selected.length > 0 ? <>
            <PermissionGate permission={PERMISSIONS.ASSET_UPDATE}>
              <Button variant="secondary" size="sm" disabled={selected.length !== 1} onClick={() => void openFormForSelected('edit')}><Pencil className="h-3.5 w-3.5" /> {t('assetActions.edit')}</Button>
              <Button variant="secondary" size="sm" disabled={selected.length !== 1} onClick={() => void openFormForSelected('copy')}><Copy className="h-3.5 w-3.5" /> {t('assetActions.copy')}</Button>
              <Button variant="secondary" size="sm" disabled={selected.length === 0} onClick={() => setBulkOpen(true)}><SlidersHorizontal className="h-3.5 w-3.5" /> {t('assetActions.bulkEdit')} ({selected.length})</Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.ASSET_DELETE}>
              <Button variant="danger" size="sm" disabled={selected.length !== 1} loading={deleting} onClick={() => void onDeleteSelected()}><Trash2 className="h-3.5 w-3.5" /> {t('assetActions.delete')}</Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.MOVEMENT_CREATE}>
              <Button variant="danger" size="sm" loading={disposing} onClick={() => void onDisposeSelected()}><Archive className="h-3.5 w-3.5" /> {t('common.dispose')} ({selected.length})</Button>
            </PermissionGate>
          </> : undefined}
        />
      </CardBody></Card>

      {formOpen && <AssetFormModal open mode={formMode} asset={formAsset} onClose={() => setFormOpen(false)} onSaved={onSaved} />}
      {bulkOpen && <AssetBulkEditModal
        open assetIds={selected} locations={locations}
        employees={employees.map((employee) => ({ value: employee.id, label: employee.department ? `${employee.name} · ${employee.department}` : employee.name }))}
        statuses={statuses.map((item) => ({ value: item.id, label: item.name }))}
        onClose={() => setBulkOpen(false)}
        onSaved={(result) => {
          toast.success(t(result.failed.length ? 'assetActions.bulkPartial' : 'assetActions.bulkDone'), `${result.updated.length}/${selected.length}`);
          setSelected([]);
          reload();
        }}
      />}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: string; tone: 'brand' | 'success' | 'warning' | 'danger' }) {
  const toneClass = {
    brand: 'bg-brand-soft text-brand', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger',
  }[tone];
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></span>
        <span className="text-2xl font-semibold tabular-nums text-ink">{value}</span>
      </div>
      <p className="mt-3 text-xs font-medium text-ink-muted">{label}</p>
    </div>
  );
}
