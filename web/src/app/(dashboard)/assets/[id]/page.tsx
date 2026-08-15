'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Pencil, Trash2, ArrowRightLeft, Archive } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, LifecycleStateBadge, BadgeTone } from '@/components/ui/Badge';
import { Timeline } from '@/components/ui/Timeline';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { usePublishCrumbTitle } from '@/lib/crumb-title';
import { EmptyState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/Tabs';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { useAsset360, Asset360Data } from '@/features/assets/use-assets';
import { useI18n, relativeTime } from '@/lib/i18n';
import { humanId, formatCurrency, formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import { useCan } from '@/lib/auth/session-context';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { AssetFormModal } from '@/features/assets/components/AssetFormModal';
import { TransferAssetModal, EndOfLifeModal } from '@/features/assets/components/AssetLifecycleModals';
import { MaintenanceOrderPanel } from '@/features/maintenance/components/MaintenanceOrderPanel';
import { getAssetMaintenanceOrders } from '@/features/maintenance/api';
import { useAsync } from '@/lib/use-async';

type Tab = 'overview' | 'lifecycle' | 'movements' | 'maintenance' | 'audit' | 'attachments';

const TONE: Record<string, BadgeTone> = {
  approved: 'success', pending: 'warning', rejected: 'danger',
};

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [endOfLife, setEndOfLife] = useState<'dispose' | 'retire' | null>(null);
  const state = useAsset360(id);
  usePublishCrumbTitle(state.data?.detail?.name ?? null);
  const { label, t, locale } = useI18n();
  const toast = useToast();
  const can = useCan();
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t('assetDetail.overview') },
    { id: 'lifecycle', label: t('assetDetail.lifecycle') },
    { id: 'movements', label: t('assetDetail.movements') },
    { id: 'maintenance', label: t('assetDetail.maintenance') },
    { id: 'audit', label: t('assetDetail.audit') },
    { id: 'attachments', label: t('assetDetail.attachments') },
  ];

  return (
    <div>
      <Link href="/assets" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('assetDetail.back')}
      </Link>

      <AsyncBoundary state={state}>
        {({ detail, lifecycle, movements, audit, depreciation }: Asset360Data) => (
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
                    <Meta label={t('assetDetail.category')} value={detail._categoryName ?? '—'} />
                    <Meta label={t('assetDetail.location')} value={detail._locationName ?? '—'} />
                    <Meta label={t('assetDetail.custodian')} value={detail._employeeName ?? '—'} />
                    <Meta label={t('assetDetail.status')} value={detail.status_id ? (detail._statusName ?? '—') : (detail.is_active ? t('assetDetail.active') : t('assetDetail.inactive'))} />
                    {detail.is_active === false ? <Badge tone="danger">{t('assetDetail.deactivated')}</Badge> : null}
                    <Meta label={t('assetDetail.value')} value={formatCurrency(detail.purchase_price, locale)} />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {lifecycle && (
                    <div className="flex items-center gap-2 rounded-lg bg-surface-muted px-3 py-2">
                      <span className="text-xs text-ink-muted">{t('assetDetail.lifecycle')}</span>
                      <LifecycleStateBadge state={lifecycle.state} />
                    </div>
                  )}
                  <ActionMenu
                    triggerLabel={t('assetDetail.actions')}
                    items={[
                      ...(can(PERMISSIONS.ASSET_UPDATE)
                        ? [{ key: 'edit', label: t('assetDetail.edit'), icon: Pencil, onClick: () => setEditOpen(true) }]
                        : []),
                      ...(can(PERMISSIONS.ASSET_TRANSFER)
                        ? [{ key: 'transfer', label: t('assetDetail.transfer'), icon: ArrowRightLeft, onClick: () => setTransferOpen(true) }]
                        : []),
                      ...(can(PERMISSIONS.MOVEMENT_CREATE)
                        ? [
                            { key: 'retire', label: t('assetDetail.retire'), icon: Archive, onClick: () => setEndOfLife('retire') },
                            { key: 'dispose', label: t('assetDetail.dispose'), icon: Trash2, tone: 'danger' as const, onClick: () => setEndOfLife('dispose') },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>
            </Card>

            {/* Tabs */}
            <div className="mb-4">
              <Tabs items={tabs} value={tab} onChange={setTab} />
            </div>

            {/* Overview */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader title={t('assetDetail.basicInfo')} />
                  <CardBody>
                    <InfoRow label={t('common.code')} value={detail.full_asset_code} />
                    <InfoRow label={t('assetDetail.baseCode')} value={detail.base_asset_code} />
                    <InfoRow label={t('assetDetail.serialNumber')} value={humanId(detail.serial_number)} />
                    <InfoRow label={t('assetDetail.barcode')} value={humanId(detail.barcode)} />
                    <InfoRow label={t('assetDetail.reference')} value={humanId(detail.reference_number)} />
                    <InfoRow label={t('assetDetail.description')} value={detail.description || '—'} />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title={t('assetDetail.financialInfo')} />
                  <CardBody>
                    <InfoRow label={t('assetDetail.purchasePrice')} value={formatCurrency(detail.purchase_price, locale)} />
                    <InfoRow label={t('assetDetail.purchaseDate')} value={formatDate(detail.purchase_date, locale)} />
                    <InfoRow label={t('assetDetail.depreciationRate')} value={detail.depreciation_rate ? `${detail.depreciation_rate}%` : '—'} />
                    <InfoRow label={t('assetDetail.usefulLife')} value={detail.useful_life ? `${detail.useful_life} ${locale === 'ar' ? 'سنة' : 'years'}` : '—'} />
                    <InfoRow label={t('assetDetail.bookValue')} value={depreciation ? formatCurrency(depreciation.bookValue, locale) : '—'} />
                    <InfoRow label={t('assetDetail.depreciated')} value={depreciation ? `${depreciation.depreciationPercentage.toFixed(1)}%` : '—'} />
                    <InfoRow label={t('assetDetail.assetAge')} value={depreciation ? (locale === 'ar' ? `${depreciation.ageYears} سنة و${depreciation.ageMonths} شهر` : `${depreciation.ageYears}y ${depreciation.ageMonths}m`) : '—'} />
                  </CardBody>
                </Card>
              </div>
            )}

            {/* Lifecycle */}
            {tab === 'lifecycle' && (
              <Card>
                <CardHeader title={t('assetDetail.lifecycle')} subtitle={t('assetDetail.lifecycleSubtitle')} />
                <CardBody>
                  {lifecycle ? (
                    <>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-sm text-ink-muted">{t('assetDetail.currentState')}</span>
                        <LifecycleStateBadge state={lifecycle.state} />
                      </div>
                      <p className="mb-2 text-sm font-medium text-ink">{t('assetDetail.allowedTransitions')}</p>
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
                          <li className="text-sm text-ink-muted">{t('assetDetail.terminal')}</li>
                        )}
                      </ul>
                    </>
                  ) : (
                    <EmptyState title={t('assetDetail.noLifecycle')} />
                  )}
                </CardBody>
              </Card>
            )}

            {/* Movements */}
            {tab === 'movements' && (
              <Card>
                <CardHeader title={t('assetDetail.movements')} subtitle={t('assetDetail.movementSubtitle')} />
                <CardBody>
                  {movements.length === 0 ? (
                    <EmptyState title={t('assetDetail.noMovements')} description={t('assetDetail.noMovementsDesc')} />
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
              <AssetMaintenanceTab assetId={detail.id} assetName={detail.name} />
            )}

            {/* Audit */}
            {tab === 'audit' && (
              <Card>
                <CardHeader title={t('assetDetail.auditInfo')} subtitle={t('assetDetail.auditSubtitle')} />
                <CardBody>
                  <InfoRow label={t('assetDetail.created')} value={relativeTime(detail.created_at)} />
                  <InfoRow label={t('assetDetail.lastUpdated')} value={relativeTime(detail.updated_at)} />
                  <div className="pt-2">
                    {audit.length === 0 ? (
                      <EmptyState title={t('assetDetail.noAudit')} />
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
                <CardHeader title={t('assetDetail.attachments')} subtitle={t('assetDetail.attachmentsUnavailable')} />
                <CardBody>
                  <EmptyState title={t('assetDetail.noAttachments')} description={t('assetDetail.attachmentsUnavailableDesc')} />
                </CardBody>
              </Card>
            )}

            {/* Real action modals */}
            {editOpen && (
              <AssetFormModal
                open
                mode="edit"
                asset={detail}
                onClose={() => setEditOpen(false)}
                onSaved={(a) => {
                  toast.success(t('assetDetail.updatedToast'), a.name);
                  setEditOpen(false);
                  state.reload();
                }}
              />
            )}
            {transferOpen && (
              <TransferAssetModal
                open
                assetId={detail.id}
                assetName={detail.name}
                onClose={() => setTransferOpen(false)}
                onDone={(message) => {
                  toast.success(t('assetDetail.transferToast'), message);
                  setTransferOpen(false);
                  state.reload();
                }}
              />
            )}
            {endOfLife && (
              <EndOfLifeModal
                open
                kind={endOfLife}
                assetId={detail.id}
                assetName={detail.name}
                onClose={() => setEndOfLife(null)}
                onDone={(message) => {
                  toast.success(endOfLife === 'dispose' ? t('assetDetail.disposalToast') : t('assetDetail.retirementToast'), message);
                  setEndOfLife(null);
                  state.reload();
                }}
              />
            )}
          </>
        )}
      </AsyncBoundary>
    </div>
  );
}

function AssetMaintenanceTab({ assetId, assetName }: { assetId: string; assetName: string }) {
  const { t } = useI18n();
  const orders = useAsync(() => getAssetMaintenanceOrders(assetId), [assetId]);
  return (
    <Card>
      <CardHeader title={t('assetDetail.maintenance')} subtitle={t('maintenance.assetSubtitle')} />
      <CardBody>
        <AsyncBoundary state={orders}>
          {(data) => <MaintenanceOrderPanel assetId={assetId} assetName={assetName} orders={data} onChanged={orders.reload} compact />}
        </AsyncBoundary>
      </CardBody>
    </Card>
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
