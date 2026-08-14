'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Download, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EnterpriseTable, EColumn } from '@/components/ui/EnterpriseTable';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useAssetList } from '@/features/assets/use-assets';
import { AssetSummary } from '@/features/assets/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { getCategories, disposeAsset, downloadAssetExport, AssetDetail } from '@/features/assets/api';
import { getLocationsTree } from '@/features/assets/components/reference-selects';
import { getStatuses, ReferenceStatus } from '@/features/reference/api';
import { AssetFormModal } from '@/features/assets/components/AssetFormModal';
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
  const [formOpen, setFormOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [disposing, setDisposing] = useState(false);
  const { data, status, error, reload } = useAssetList({
    q,
    category_id: category ?? undefined,
    location_id: location ?? undefined,
    status_id: statusId ?? undefined,
    page,
    limit: 20,
  });
  const toast = useToast();
  const { confirm } = useConfirm();
  const { t } = useI18n();

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
    getLocationsTree().then(setLocations).catch(() => undefined);
    getStatuses().then(setStatuses).catch(() => undefined);
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
    {
      key: 'name', header: t('common.name'), sortable: true,
      render: (r) => (
        <Link href={`/assets/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>
      ),
    },
    { key: 'location_id', header: t('common.location'), render: (r) => r._locationName ?? '—' },
    { key: 'employee_id', header: t('common.custodian'), render: (r) => r._employeeName ?? '—' },
    {
      key: 'status_id', header: t('common.status'),
      render: (r) =>
        r.status_id ? <Badge tone={statusTone(r.status_id)}>{statusName(r.status_id)}</Badge> :
          (r.is_active ? <Badge tone="success">{t('common.active')}</Badge> : <Badge tone="neutral">{t('common.inactive')}</Badge>),
    },
    { key: 'quantity', header: t('common.quantity'), align: 'center', render: (r) => <span className="text-ink-muted">{r.quantity}</span> },
    {
      key: 'purchase_price', header: t('common.value'), align: 'right', sortable: true,
      accessor: (r) => Number(r.purchase_price || 0),
      render: (r) => formatCurrency(r.purchase_price),
    },
  ];

  const onCreate = async (asset: AssetDetail) => {
    toast.success(t('common.assetCreated'), `${asset.name} · ${t('common.code')} ${asset.full_asset_code}`);
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

  const onDisposeSelected = async () => {
    if (selected.length === 0) return;
    const ok = await confirm({
      title: `Request disposal for ${selected.length} asset(s)`,
      message: 'One disposal movement will be created per asset. Assets are deactivated only after each movement is approved.',
      tone: 'danger',
      confirmLabel: 'Create disposal requests',
    });
    if (!ok) return;
    setDisposing(true);
    const results = await Promise.allSettled(selected.map((id) => disposeAsset(id)));
    setDisposing(false);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    if (succeeded > 0) {
      toast.success(t('common.disposalRequestsCreated'), `${succeeded} movement(s) are now pending approval.`);
    }
    if (failed > 0) {
      const firstError = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      toast.error(t('common.someRequestsFailed'), failed === 1 ? humanError(firstError?.reason) : `${failed} requests failed.`);
    }
    setSelected([]);
    reload();
  };

  return (
    <div>
      <PageHeader
        title={t('nav.assets')}
        subtitle={`${data?.total?.toLocaleString() ?? '—'} ${t('common.assets')}`}
        actions={
          <div className="flex items-center gap-2">
            <PermissionGate permission={PERMISSIONS.EXPORT_ASSETS}>
              <Button variant="secondary" size="sm" onClick={() => void onExport()} loading={exporting}>
                <Download className="h-4 w-4" /> {t('common.export')}
              </Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.ASSET_CREATE}>
              <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" /> {t('common.newAsset')}
              </Button>
            </PermissionGate>
          </div>
        }
      />

      <Card className="p-0">
        <CardBody className="p-0">
          <EnterpriseTable
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(r) => r.id}
            loading={status === 'loading'}
            error={error ? humanError(error) : null}
            onRetry={reload}
            page={page}
            pageSize={20}
            total={data?.total ?? 0}
            onPageChange={setPage}
            sortKey={sortKey}
            sortDir={sortDir}
            onSortChange={(k, d) => { setSortKey(k); setSortDir(d); }}
            searchable
            searchValue={q}
            onSearch={(v) => { setQ(v); setPage(1); }}
            selectable
            selectedKeys={selected}
            onSelectionChange={setSelected}
            defaultHiddenColumns={['quantity']}
            toolbarActions={
              <>
                <div className="w-full sm:w-44">
                  <SearchableSelect
                    options={categories}
                    value={category}
                    onChange={(v) => { setCategory(v); setPage(1); }}
                    placeholder={t('common.type')}
                  />
                </div>
                <div className="w-full sm:w-52">
                  <SearchableSelect
                    options={locations}
                    value={location}
                    onChange={(v) => { setLocation(v); setPage(1); }}
                    placeholder={t('common.location')}
                  />
                </div>
                <div className="w-full sm:w-44">
                  <SearchableSelect
                    options={statuses.map((s) => ({ value: s.id, label: s.name }))}
                    value={statusId}
                    onChange={(v) => { setStatusId(v); setPage(1); }}
                    placeholder={t('common.status')}
                  />
                </div>
                <PermissionGate permission={PERMISSIONS.MOVEMENT_CREATE}>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={selected.length === 0}
                    loading={disposing}
                    onClick={() => void onDisposeSelected()}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t('common.dispose')} ({selected.length})
                  </Button>
                </PermissionGate>
              </>
            }
          />
        </CardBody>
      </Card>

      {formOpen && (
        <AssetFormModal
          open
          mode="create"
          onClose={() => setFormOpen(false)}
          onSaved={(asset) => void onCreate(asset)}
        />
      )}
    </div>
  );
}
