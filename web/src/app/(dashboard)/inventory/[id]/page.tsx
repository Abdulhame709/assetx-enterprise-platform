'use client';

/**
 * Inventory Cycle detail — the operational counting workspace.
 * Reads: cycle + summary (computed) + records (snapshot rows).
 * Writes: start / close / count / recount / verify — all real endpoints.
 * Backend guards are mirrored as UX gates only (it remains the security boundary).
 */
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Play, Lock, CheckCheck, Undo2, ClipboardCheck,
  Boxes, ScanSearch, TrendingUp, ArrowLeftRight, PackageX,
} from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { KpiCard } from '@/components/ui/KpiCard';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { usePublishCrumbTitle } from '@/lib/crumb-title';
import { EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/Button';
import { EnterpriseTable, EColumn } from '@/components/ui/EnterpriseTable';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useCan } from '@/lib/auth/session-context';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';
import { useCycleDetail, CycleDetailData } from '@/features/inventory/use-inventory';
import { startCycle, closeCycle, verifyRecord, InventoryRecordRow, CycleStatus } from '@/features/inventory/api';
import { CountRecordModal, RESULT_TONE } from '@/features/inventory/components/RecordFormModal';

const CYCLE_TONE: Record<CycleStatus, BadgeTone> = {
  new: 'neutral',
  in_progress: 'warning',
  closed: 'success',
};

export default function InventoryCyclePage() {
  const { id } = useParams<{ id: string }>();
  const state = useCycleDetail(id);
  usePublishCrumbTitle(state.data ? `Cycle ${state.data.cycle.year}` : null);
  const { label, t, locale } = useI18n();
  const toast = useToast();
  const { confirm } = useConfirm();
  const can = useCan();

  const [countRecord, setCountRecord] = useState<InventoryRecordRow | null>(null);
  const [resultFilter, setResultFilter] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const writable = (data: CycleDetailData) =>
    data.cycle.status === 'in_progress' && can(PERMISSIONS.INVENTORY_EXECUTE);
  const canVerify = () => can(PERMISSIONS.INVENTORY_VERIFY);

  const onStart = async () => {
    const ok = await confirm({
      title: t('inventory.startConfirm'),
      message: t('inventory.startMessage'),
      confirmLabel: t('inventory.startAction'),
    });
    if (!ok) return;
    setTransitioning(true);
    try {
      await startCycle(id);
      toast.success(t('inventory.startedToast'), t('inventory.startedToastMessage'));
      state.reload();
    } catch (err) {
      toast.error(t('inventory.verificationFailed', 'Could not start'), humanError(err));
    } finally {
      setTransitioning(false);
    }
  };

  const onClose = async (summary: CycleDetailData['summary']) => {
    const pendingText = summary && summary.not_inventoried > 0
      ? ` ${summary.not_inventoried} ${t('inventory.recordsUncounted')}`
      : '';
    const ok = await confirm({
      title: t('inventory.closeConfirm'),
      message: `${t('inventory.closeMessage')}${pendingText}`,
      tone: 'warning',
      confirmLabel: t('inventory.closeAction'),
    });
    if (!ok) return;
    setTransitioning(true);
    try {
      await closeCycle(id);
      toast.success(t('inventory.closedToast'), t('inventory.closedToastMessage'));
      state.reload();
    } catch (err) {
      toast.error(t('inventory.verificationFailed', 'Could not close'), humanError(err));
    } finally {
      setTransitioning(false);
    }
  };

  const onVerify = async (record: InventoryRecordRow, verified: boolean) => {
    setVerifyingId(record.id);
    try {
      await verifyRecord(record.id, verified);
      toast.success(verified ? t('inventory.recordVerified') : t('inventory.verificationRemoved'), record._assetName);
      state.reload();
    } catch (err) {
      toast.error(t('inventory.verificationFailed'), humanError(err));
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div>
      <Link href="/inventory" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('inventory.backToCycles')}
      </Link>

      <AsyncBoundary state={state}>
        {(data: CycleDetailData) => {
          const { cycle, summary, records, locationSuggestions } = data;
          const writableNow = writable(data);
          const filtered = records.filter((r) => !resultFilter || r.result === resultFilter);

          return (
            <>
              {/* Header */}
              <Card className="mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold text-ink">{t('inventory.cycle')} {cycle.year}</h1>
                      <Badge tone={CYCLE_TONE[cycle.status]}>{label(cycle.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {cycle.start_date ? `${t('inventory.started')} ${new Date(cycle.start_date).toLocaleDateString(locale)}` : t('inventory.notStarted')}
                      {cycle.end_date ? ` · ${t('inventory.closed')} ${new Date(cycle.end_date).toLocaleDateString(locale)}` : ''}
                      {summary ? ` · ${t('inventory.netVariance')} ${summary.variance}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {cycle.status === 'new' && can(PERMISSIONS.INVENTORY_EXECUTE) && (
                      <Button variant="primary" size="sm" loading={transitioning} onClick={() => void onStart()}>
                        <Play className="h-4 w-4" /> {t('inventory.start')}
                      </Button>
                    )}
                    {cycle.status === 'in_progress' && can(PERMISSIONS.INVENTORY_CLOSE) && (
                      <Button variant="secondary" size="sm" loading={transitioning} onClick={() => void onClose(summary)}>
                        <Lock className="h-4 w-4" /> {t('inventory.close')}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* Summary (all values from the computed summary endpoint) */}
              {summary && (
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  <KpiCard label={t('inventory.expected')} value={summary.expected_assets.toLocaleString()} icon={Boxes} tone="brand" />
                  <KpiCard label={t('inventory.counted')} value={`${summary.inventoried} (${summary.completion}%)`} icon={ScanSearch} tone="info" />
                  <KpiCard label={t('inventory.matched')} value={summary.found.toLocaleString()} icon={CheckCheck} tone="success" />
                  <KpiCard label={t('inventory.deficitExtra')} value={`${summary.deficit} / ${summary.extra}`} icon={TrendingUp} tone="warning" />
                  <KpiCard label={t('inventory.missing')} value={summary.missing.toLocaleString()} icon={PackageX} tone="danger" />
                  <KpiCard label={t('inventory.transferredUncounted')} value={`${summary.transferred} / ${summary.not_inventoried}`} icon={ArrowLeftRight} tone="neutral" />
                </div>
              )}

              {locationSuggestions.length > 0 && (
                <Card className="mb-4">
                  <CardBody>
                    <h2 className="text-base font-semibold text-ink">{t('inventory.aiLocationTitle')}</h2>
                    <p className="mt-1 text-sm text-ink-muted">{t('inventory.aiLocationSubtitle')}</p>
                    <div className="mt-3 space-y-2">
                      {locationSuggestions.map((suggestion) => {
                        const record = records.find((item) => item.id === suggestion.record_id);
                        const reasons = suggestion.reasonCodes.map((code) => {
                          if (code === 'LOCATION_MISMATCH') return t('inventory.aiLocationMismatch');
                          if (code === 'QUANTITY_VARIANCE') return t('inventory.aiQuantityVariance');
                          return t('inventory.aiLocationUnresolved');
                        });
                        return (
                          <div key={suggestion.record_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
                            <div className="min-w-0">
                              <p className="font-medium text-ink">{suggestion.asset_name} <span className="font-mono text-xs text-ink-faint">{suggestion.asset_code}</span></p>
                              <p className="text-xs text-ink-muted">{suggestion.expected_location ?? '—'} ← {suggestion.actual_location ?? '—'} · {reasons.join(' ')}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge tone={suggestion.riskLevel === 'high' ? 'danger' : 'warning'}>{suggestion.riskLevel === 'high' ? t('inventory.aiRiskHigh') : t('inventory.aiRiskMedium')} {suggestion.riskScore}%</Badge>
                              {record && writableNow && <Button variant="secondary" size="sm" onClick={() => setCountRecord(record)}>{t('inventory.aiReview')}</Button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Records */}
              <Card className="p-0">
                <CardBody className="p-0">
                  <RecordsTable
                    records={filtered}
                    resultFilter={resultFilter}
                    onResultFilter={setResultFilter}
                    writable={writableNow}
                    verifyingId={verifyingId}
                    canVerifyNow={canVerify()}
                    closed={cycle.status === 'closed'}
                    onCount={(r) => setCountRecord(r)}
                    onVerify={(r, v) => void onVerify(r, v)}
                    label={label}
                    t={t}
                  />
                </CardBody>
              </Card>

              {countRecord && (
                <CountRecordModal
                  open
                  cycleId={cycle.id}
                  record={countRecord}
                  lookups={data.lookups}
                  onClose={() => setCountRecord(null)}
                  onSaved={() => {
                    toast.success(t('inventory.countSaved'), t('inventory.countSavedMessage'));
                    setCountRecord(null);
                    state.reload();
                  }}
                />
              )}
            </>
          );
        }}
      </AsyncBoundary>
    </div>
  );
}

function RecordsTable({
  records, resultFilter, onResultFilter, writable, verifyingId, canVerifyNow, closed,
  onCount, onVerify, label, t,
}: {
  records: InventoryRecordRow[];
  resultFilter: string | null;
  onResultFilter: (v: string | null) => void;
  writable: boolean;
  verifyingId: string | null;
  canVerifyNow: boolean;
  closed: boolean;
  onCount: (r: InventoryRecordRow) => void;
  onVerify: (r: InventoryRecordRow, v: boolean) => void;
  label: (code?: string | null) => string;
  t: (key: string, fallback?: string) => string;
}) {
  const resultOptions = useMemo(
    () => [
      { value: 'not_inventoried', label: label('not_inventoried') },
      { value: 'matched', label: label('matched') },
      { value: 'deficit', label: label('deficit') },
      { value: 'surplus', label: label('surplus') },
      { value: 'transferred', label: label('transferred') },
      { value: 'missing', label: label('missing') },
    ],
    [label],
  );

  const columns: EColumn<InventoryRecordRow>[] = [
    {
      key: 'asset', header: t('inventory.asset'),
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{r._assetName ?? '—'}</div>
          <div className="text-xs text-ink-faint">{r._assetCode ?? ''}</div>
        </div>
      ),
    },
    { key: 'expected', header: t('inventory.expected'), render: (r) => <span className="text-ink-muted">{`${t('common.quantity')} ${r.expected_quantity ?? '—'} · ${r._expectedLocation ?? '—'}`}</span> },
    {
      key: 'actual', header: t('inventory.counted'),
      render: (r) => r.actual_quantity == null
        ? <span className="text-ink-faint">—</span>
        : <span className="text-ink">{`${t('common.quantity')} ${r.actual_quantity} · ${r._actualLocation ?? '—'}`}</span>,
    },
    {
      key: 'result', header: t('inventory.result'), accessor: (r) => r.result,
      render: (r) => <Badge tone={RESULT_TONE[r.result]}>{label(r.result)}</Badge>,
    },
    { key: 'date', header: t('inventory.countedOn'), render: (r) => <span className="text-xs text-ink-faint">{r.inventory_date ? new Date(r.inventory_date).toLocaleDateString() : '—'}</span> },
    {
      key: 'verified', header: t('inventory.verified'),
      render: (r) => r.is_verified ? <Badge tone="success">{t('inventory.verified')}</Badge> : <span className="text-xs text-ink-faint">—</span>,
    },
    {
      key: 'actions', header: '', width: '210px', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {writable && (
            <Button variant="secondary" size="sm" onClick={() => onCount(r)}>
              <ClipboardCheck className="h-3.5 w-3.5" /> {r.result === 'not_inventoried' ? t('inventory.count') : t('inventory.recount')}
            </Button>
          )}
          {canVerifyNow && !closed && r.result !== 'not_inventoried' && !r.is_verified && (
            <Button variant="ghost" size="sm" loading={verifyingId === r.id} onClick={() => onVerify(r, true)}>
              <CheckCheck className="h-3.5 w-3.5 text-success" /> {t('inventory.verify')}
            </Button>
          )}
          {canVerifyNow && !closed && r.is_verified && (
            <Button variant="ghost" size="sm" loading={verifyingId === r.id} onClick={() => onVerify(r, false)}>
              <Undo2 className="h-3.5 w-3.5 text-ink-faint" /> {t('inventory.unverify')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <EnterpriseTable
      columns={columns}
      rows={records}
      rowKey={(r) => r.id}
      pageSize={records.length || 1}
      total={records.length}
      searchable={false}
      empty={
        <EmptyState
          title={resultFilter ? t('inventory.noFilterRecords') : t('inventory.noSnapshotRecords')}
          description={resultFilter ? t('inventory.tryDifferentFilter') : t('inventory.snapshotNoAssets')}
        />
      }
      toolbarActions={
        <div className="w-52">
          <SearchableSelect options={resultOptions} value={resultFilter} onChange={onResultFilter} placeholder={t('inventory.filterByResult')} />
        </div>
      }
    />
  );
}
