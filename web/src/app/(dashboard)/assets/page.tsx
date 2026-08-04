'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Download, Plus, Columns } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { DataTable, Column } from '@/components/ui/DataTable';
import { SearchInput, FilterBar } from '@/components/ui/FilterBar';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { PermissionGate, usePermissionGuard } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useAssetList } from '@/features/assets/use-assets';
import { AssetSummary } from '@/features/assets/types';

export default function AssetsPage() {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAssetList({ q, page, limit: 20 });
  const can = usePermissionGuard();

  const columns: Column<AssetSummary>[] = [
    { key: 'full_asset_code', header: 'Code', width: '130px' },
    {
      key: 'name', header: 'Asset',
      render: (r) => (
        <Link href={`/assets/${r.id}`} className="font-medium text-brand hover:underline">{r.name}</Link>
      ),
    },
    { key: 'category', header: 'Category' },
    { key: 'location', header: 'Location' },
    {
      key: 'quantity', header: 'Qty', align: 'center',
      render: (r) => <span className="text-ink-muted">{r.quantity}</span>,
    },
    {
      key: 'purchase_price', header: 'Value', align: 'right',
      render: (r) => `$${Number(r.purchase_price).toLocaleString()}`,
    },
    {
      key: 'is_active', header: 'Status', align: 'center',
      render: (r) => r.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>,
    },
    {
      key: 'actions', header: '', align: 'right', width: '40px',
      render: () => (
        <ActionMenu
          items={[
            { key: 'view', label: 'View details', onClick: () => undefined },
            { key: 'edit', label: 'Edit', onClick: () => undefined },
            ...(can(PERMISSIONS.ASSET_TRANSFER) ? [{ key: 'transfer', label: 'Transfer', onClick: () => undefined }] : []),
            ...(can(PERMISSIONS.ASSET_DISPOSE) ? [{ key: 'dispose', label: 'Dispose', tone: 'danger' as const, onClick: () => undefined }] : []),
          ]}
        />
      ),
    },
  ];

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  return (
    <div>
      <PageHeader
        title="Assets"
        subtitle={`${data?.total?.toLocaleString() ?? '—'} assets`}
        actions={
          <div className="flex items-center gap-2">
            <PermissionGate permission={PERMISSIONS.ASSET_CREATE}>
              <Button variant="primary" size="sm"><Plus className="h-4 w-4" /> New Asset</Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.REPORT_EXPORT}>
              <Button variant="secondary" size="sm"><Download className="h-4 w-4" /> Export</Button>
            </PermissionGate>
            <Button variant="secondary" size="sm"><Columns className="h-4 w-4" /> Columns</Button>
          </div>
        }
      />

      <Card>
        <CardBody>
          <div className="mb-4">
            <FilterBar>
              <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search assets…" className="w-72" />
              <Button variant="secondary" size="sm">Category</Button>
              <Button variant="secondary" size="sm">Location</Button>
              <Button variant="secondary" size="sm">Lifecycle</Button>
              <Button variant="secondary" size="sm">Date range</Button>
            </FilterBar>
          </div>

          <DataTable columns={columns} rows={data?.items ?? []} rowKey={(r) => r.id} loading={loading} error={error} onRetry={reload} />

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-ink-muted">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
