'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Pencil, ArrowRightLeft, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EnterpriseTable, EColumn } from '@/components/ui/EnterpriseTable';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PermissionGate, usePermissionGuard } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useAssetList } from '@/features/assets/use-assets';
import { AssetSummary } from '@/features/assets/types';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatCurrency } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

export default function AssetsPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('full_asset_code');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<string[]>([]);
  const { data, status, error, reload } = useAssetList({ q, page, limit: 20 });
  const can = usePermissionGuard();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { label } = useI18n();

  const columns: EColumn<AssetSummary>[] = [
    { key: 'full_asset_code', header: 'Code', width: '130px', sortable: true },
    {
      key: 'name', header: 'Asset', sortable: true,
      render: (r) => (
        <Link href={`/assets/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>
      ),
    },
    { key: 'location_id', header: 'Location', render: (r) => label(r.location_id ?? undefined) },
    { key: 'employee_id', header: 'Custodian', render: (r) => label(r.employee_id ?? undefined) },
    { key: 'quantity', header: 'Qty', align: 'center', render: (r) => <span className="text-ink-muted">{r.quantity}</span> },
    { key: 'purchase_price', header: 'Value', align: 'right', sortable: true, render: (r) => formatCurrency(r.purchase_price) },
    {
      key: 'is_active', header: 'Status', align: 'center',
      render: (r) => r.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>,
    },
  ];

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  const onDisposeSelected = async () => {
    if (selected.length === 0) return;
    const ok = await confirm({
      title: `Dispose ${selected.length} asset(s)`,
      message: 'This will permanently dispose the selected assets. This action cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Dispose',
    });
    if (ok) { toast.warning('Dispose', 'Bulk workflow not connected yet.'); setSelected([]); }
  };

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle={`${data?.total?.toLocaleString() ?? '—'} assets`}
        actions={
          <div className="flex items-center gap-2">
            <PermissionGate permission={PERMISSIONS.ASSET_CREATE}>
              <Button variant="primary" size="sm" onClick={() => toast.info('New asset', 'Create workflow not connected yet.')}>
                <Plus className="h-4 w-4" /> New Asset
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
            error={error}
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
            exportable
            onExport={() => toast.info('Export', 'Export workflow not connected yet.')}
            selectable
            selectedKeys={selected}
            onSelectionChange={setSelected}
            defaultHiddenColumns={['quantity']}
            toolbarActions={
              <PermissionGate permission={PERMISSIONS.ASSET_DISPOSE}>
                <Button variant="danger" size="sm" disabled={selected.length === 0} onClick={() => void onDisposeSelected()}>
                  <Trash2 className="h-3.5 w-3.5" /> Dispose ({selected.length})
                </Button>
              </PermissionGate>
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
