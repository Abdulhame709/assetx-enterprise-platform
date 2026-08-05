'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2, ArrowRightLeft, Wrench } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, LifecycleStateBadge, BadgeTone } from '@/components/ui/Badge';
import { Timeline } from '@/components/ui/Timeline';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { EmptyState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/Tabs';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { useAsset360, Asset360Data } from '@/features/assets/use-assets';
import { useI18n, relativeTime } from '@/lib/i18n';
import { humanId, formatCurrency } from '@/lib/format';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';

type Tab = 'overview' | 'lifecycle' | 'movements' | 'maintenance' | 'audit' | 'attachments';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'movements', label: 'Movement History' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'audit', label: 'Audit' },
  { id: 'attachments', label: 'Attachments' },
];

const TONE: Record<string, BadgeTone> = {
  approved: 'success', pending: 'warning', rejected: 'danger',
};

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const state = useAsset360(id);
  const { label } = useI18n();
  const { confirm } = useConfirm();
  const toast = useToast();

  const onDispose = async () => {
    const ok = await confirm({
      title: 'Dispose asset',
      message: 'This will permanently dispose the asset. This action cannot be undone.',
      tone: 'danger',
      confirmLabel: 'Dispose',
    });
    if (ok) toast.info('Dispose', 'Workflow not connected yet.');
  };

  return (
    <div>
      <Link href="/assets" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back to assets
      </Link>

      <AsyncBoundary state={state}>
        {({ detail, lifecycle, movements, audit }: Asset360Data) => (
          <>
            {/* Header */}
            <Card className="mb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold text-ink">{detail.name}</h1>
                    <Badge tone="neutral">{detail.full_asset_code}</Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                    <Meta label="Category" value={label(detail.category_id ?? undefined)} />
                    <Meta label="Location" value={label(detail.location_id ?? undefined)} />
                    <Meta label="Custodian" value={label(detail.employee_id ?? undefined)} />
                    <Meta label="Status" value={detail.is_active ? 'Active' : 'Inactive'} />
                    <Meta label="Value" value={formatCurrency(detail.purchase_price)} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lifecycle && (
                    <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2">
                      <span className="text-xs text-ink-muted">Lifecycle</span>
                      <LifecycleStateBadge state={lifecycle.state} />
                    </div>
                  )}
                  <ActionMenu
                    triggerLabel="Asset actions"
                    items={[
                      { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => toast.info('Edit', 'Edit workflow not connected yet.') },
                      { key: 'transfer', label: 'Transfer', icon: ArrowRightLeft, onClick: () => toast.info('Transfer', 'Transfer workflow not connected yet.') },
                      { key: 'maintenance', label: 'Start maintenance', icon: Wrench, onClick: () => toast.info('Maintenance', 'Awaiting L5.') },
                      { key: 'dispose', label: 'Dispose', icon: Trash2, tone: 'danger', onClick: () => void onDispose() },
                    ]}
                  />
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <div className="mb-4">
              <Tabs items={TABS} value={tab} onChange={setTab} />
            </div>

            {/* Overview */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Basic Information" />
                  <CardBody>
                    <InfoRow label="Code" value={detail.full_asset_code} />
                    <InfoRow label="Base code" value={detail.base_asset_code} />
                    <InfoRow label="Serial number" value={humanId(detail.serial_number)} />
                    <InfoRow label="Barcode" value={humanId(detail.barcode)} />
                    <InfoRow label="Reference" value={humanId(detail.reference_number)} />
                    <InfoRow label="Description" value={detail.description || '—'} />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Financial Information" />
                  <CardBody>
                    <InfoRow label="Purchase price" value={formatCurrency(detail.purchase_price)} />
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
                          <li key={`${t.from}-${t.to}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                            <span className="capitalize text-ink-muted">{label(t.from)}</span>
                            <span className="text-brand">→</span>
                            <span className="font-medium text-ink capitalize">{label(t.to)}</span>
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
                        title: <span className="capitalize">{label(m.movement_type)}</span>,
                        meta: <Badge tone={TONE[m.status] ?? 'neutral'}>{label(m.status)}</Badge>,
                        description: m.reason ?? '',
                        time: relativeTime(m.created_at),
                        tone: TONE[m.status],
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
                  <InfoRow label="Created" value={relativeTime(detail.created_at)} />
                  <InfoRow label="Last updated" value={relativeTime(detail.updated_at)} />
                  <div className="pt-2">
                    {audit.length === 0 ? (
                      <EmptyState title="No audit events" />
                    ) : (
                      <Timeline
                        entries={audit.map((e) => ({
                          id: e.id,
                          title: label(e.action_type),
                          meta: <span className="text-ink-faint">{relativeTime(e.created_at)}</span>,
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
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-ink-faint">{label}:</span>
      <span className="font-medium text-ink">{value}</span>
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-end text-ink">{value}</span>
    </div>
  );
}
