'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, LifecycleStateBadge } from '@/components/ui/Badge';
import { Timeline } from '@/components/ui/Timeline';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { useAsset360 } from '@/features/assets/use-assets';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';

type Tab = 'overview' | 'lifecycle' | 'movements' | 'maintenance' | 'audit' | 'attachments';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'movements', label: 'Movement History' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'audit', label: 'Audit' },
  { id: 'attachments', label: 'Attachments' },
];

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const { detail, lifecycle, movements, audit, loading, error } = useAsset360(id);

  if (loading) return <LoadingState rows={8} />;
  if (error) return <ErrorState message={error} />;
  if (!detail) return <EmptyState />;

  const activeTone = lifecycle?.state === 'disposed' || lifecycle?.state === 'archived' ? 'danger' : 'success';

  return (
    <div>
      <Link href="/assets" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back to assets
      </Link>

      {/* Header */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-ink">{detail.name}</h1>
              <Badge tone="neutral">{detail.full_asset_code}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
              <span>Category: {detail.category_id ?? '—'}</span>
              <span>Location: {detail.location_id ?? '—'}</span>
              <span>Custodian: {detail.employee_id ?? '—'}</span>
              <span>Status: <Badge tone={detail.is_active ? 'success' : 'neutral'}>{detail.is_active ? 'Active' : 'Inactive'}</Badge></span>
            </div>
          </div>
          {lifecycle && (
            <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2">
              <span className="text-xs text-ink-muted">Lifecycle</span>
              <LifecycleStateBadge state={lifecycle.state} />
              <span className={cn('h-2 w-2 rounded-full', activeTone === 'success' ? 'bg-success' : 'bg-danger')} />
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-medium',
              tab === t.id ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Basic Information" />
            <CardBody>
              <InfoRow label="Code" value={detail.full_asset_code} />
              <InfoRow label="Base code" value={detail.base_asset_code} />
              <InfoRow label="Serial number" value={detail.serial_number ?? '—'} />
              <InfoRow label="Barcode" value={detail.barcode ?? '—'} />
              <InfoRow label="Reference" value={detail.reference_number ?? '—'} />
              <InfoRow label="Description" value={detail.description ?? '—'} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Financial Information" />
            <CardBody>
              <InfoRow label="Purchase price" value={`$${Number(detail.purchase_price).toLocaleString()}`} />
              <InfoRow label="Purchase date" value={detail.purchase_date ?? '—'} />
              <InfoRow label="Depreciation rate" value={detail.depreciation_rate ? `${detail.depreciation_rate}%` : '—'} />
              <InfoRow label="Useful life" value={detail.useful_life ? `${detail.useful_life} years` : '—'} />
            </CardBody>
          </Card>
        </div>
      )}

      {/* Lifecycle */}
      {tab === 'lifecycle' && (
        <Card>
          <CardHeader title="Lifecycle" subtitle="Current derived state + allowed transitions" />
          <CardBody>
            {lifecycle ? (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm text-ink-muted">Current state:</span>
                  <LifecycleStateBadge state={lifecycle.state} />
                </div>
                <p className="mb-2 text-sm font-medium text-ink">Allowed transitions</p>
                <ul className="space-y-2">
                  {lifecycle.allowedTransitions.map((t) => (
                    <li key={`${t.from}-${t.to}`} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                      <span className="text-ink-muted">{t.from.replace(/_/g, ' ')}</span>
                      <span className="text-brand">→</span>
                      <span className="font-medium text-ink capitalize">{t.to.replace(/_/g, ' ')}</span>
                      {t.reason && <span className="text-xs text-ink-faint">{t.reason}</span>}
                    </li>
                  ))}
                  {lifecycle.allowedTransitions.length === 0 && (
                    <li className="text-sm text-ink-muted">This asset is in a terminal state with no outgoing transitions.</li>
                  )}
                </ul>
              </>
            ) : (
              <EmptyState title="No lifecycle data" />
            )}
          </CardBody>
        </Card>
      )}

      {/* Movements */}
      {tab === 'movements' && (
        <Card>
          <CardHeader title="Movement History" subtitle="Assignment, transfer, return, disposal" />
          <CardBody>
            {movements.length === 0 ? (
              <EmptyState title="No movements" description="No asset movements have been recorded." />
            ) : (
              <Timeline
                entries={movements.map((m) => ({
                  id: m.id,
                  title: <span className="capitalize">{m.movement_type.replace(/_/g, ' ')}</span>,
                  meta: <Badge tone={m.status === 'approved' ? 'success' : m.status === 'pending' ? 'warning' : 'danger'}>{m.status}</Badge>,
                  description: m.reason ?? '',
                  time: new Date(m.created_at).toLocaleDateString(),
                }))}
              />
            )}
          </CardBody>
        </Card>
      )}

      {/* Maintenance */}
      {tab === 'maintenance' && (
        <Card>
          <CardHeader title="Maintenance" subtitle="Placeholder — awaits L5 Maintenance Automation" />
          <CardBody>
            <EmptyState
              title="Maintenance history"
              description="Maintenance automation is planned for a later phase (L5). No maintenance records yet."
            />
          </CardBody>
        </Card>
      )}

      {/* Audit */}
      {tab === 'audit' && (
        <Card>
          <CardHeader title="Audit Information" subtitle="Creation and modification history" />
          <CardBody>
            <InfoRow label="Created" value={detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'} />
            <InfoRow label="Last updated" value={detail.updated_at ? new Date(detail.updated_at).toLocaleString() : '—'} />
            <div className="pt-2">
              {audit.length === 0 ? (
                <EmptyState title="No audit events" />
              ) : (
                <Timeline
                  entries={audit.map((e) => ({
                    id: e.id,
                    title: <span className="font-mono text-xs">{e.action_type}</span>,
                    time: new Date(e.created_at).toLocaleString(),
                  }))}
                />
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Attachments */}
      {tab === 'attachments' && (
        <Card>
          <CardHeader title="Attachments" subtitle="UI placeholder — storage not yet implemented" />
          <CardBody>
            <EmptyState title="No attachments" description="Attachment storage is planned for a later phase." />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line py-1.5 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}
