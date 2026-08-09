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
  const { label } = useI18n();
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
      title: 'Start this cycle?',
      message: 'Counting begins. The snapshot stays as it was created.',
      confirmLabel: 'Start cycle',
    });
    if (!ok) return;
    setTransitioning(true);
    try {
      await startCycle(id);
      toast.success('Cycle started', 'The cycle is now in progress — you can record counts.');
      state.reload();
    } catch (err) {
      toast.error('Could not start', humanError(err));
    } finally {
      setTransitioning(false);
    }
  };

  const onClose = async (summary: CycleDetailData['summary']) => {
    const pendingText = summary && summary.not_inventoried > 0
      ? ` ${summary.not_inventoried} record(s) are still uncounted.`
      : '';
    const ok = await confirm({
      title: 'Close this cycle?',
      message: `Closing is final — records become read-only.${pendingText}`,
      tone: 'warning',
      confirmLabel: 'Close cycle',
    });
    if (!ok) return;
    setTransitioning(true);
    try {
      await closeCycle(id);
      toast.success('Cycle closed', 'Records are locked. Summary is final.');
      state.reload();
    } catch (err) {
      toast.error('Could not close', humanError(err));
    } finally {
      setTransitioning(false);
    }
  };

  const onVerify = async (record: InventoryRecordRow, verified: boolean) => {
    setVerifyingId(record.id);
    try {
      await verifyRecord(record.id, verified);
      toast.success(verified ? 'Record verified' : 'Verification removed', record._assetName);
      state.reload();
    } catch (err) {
      toast.error('Verification failed', humanError(err));
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div>
      <Link href="/inventory" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> Back to cycles
      </Link>

      <AsyncBoundary state={state}>
        {(data: CycleDetailData) => {
          const { cycle, summary, records } = data;
          const writableNow = writable(data);
          const filtered = records.filter((r) => !resultFilter || r.result === resultFilter);

          return (
            <>
              {/* Header */}
              <Card className="mb-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold text-ink">Inventory Cycle {cycle.year}</h1>
                      <Badge tone={CYCLE_TONE[cycle.status]}>{label(cycle.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">
                      {cycle.start_date ? `Started ${new Date(cycle.start_date).toLocaleDateString()}` : 'Not started yet'}
                      {cycle.end_date ? ` · Closed ${new Date(cycle.end_date).toLocaleDateString()}` : ''}
                      {summary ? ` · Net variance ${summary.variance}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {cycle.status === 'new' && can(PERMISSIONS.INVENTORY_EXECUTE) && (
                      <Button variant="primary" size="sm" loading={transitioning} onClick={() => void onStart()}>
                        <Play className="h-4 w-4" /> Start Cycle
                      </Button>
                    )}
                    {cycle.status === 'in_progress' && can(PERMISSIONS.INVENTORY_CLOSE) && (
                      <Button variant="secondary" size="sm" loading={transitioning} onClick={() => void onClose(summary)}>
                        <Lock className="h-4 w-4" /> Close Cycle
                      </Button>
                    )}
                  </div>
                </div>
              </Card>

              {/* Summary (all values from the computed summary endpoint) */}
              {summary && (
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  <KpiCard label="Expected" value={summary.expected_assets.toLocaleString()} icon={Boxes} tone="brand" />
                  <KpiCard label="Counted" value={`${summary.inventoried} (${summary.completion}%)`} icon={ScanSearch} tone="info" />
                  <KpiCard label="Matched" value={summary.found.toLocaleString()} icon={CheckCheck} tone="success" />
                  <KpiCard label="Deficit / Extra" value={`${summary.deficit} / ${summary.extra}`} icon={TrendingUp} tone="warning" />
                  <KpiCard label="Missing" value={summary.missing.toLocaleString()} icon={PackageX} tone="danger" />
                  <KpiCard label="Transferred / Uncounted" value={`${summary.transferred} / ${summary.not_inventoried}`} icon={ArrowLeftRight} tone="neutral" />
                </div>
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
                    toast.success('Count saved', 'The record result was recomputed.');
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
  onCount, onVerify, label,
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
      key: 'asset', header: 'Asset',
      render: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{r._assetName ?? '—'}</div>
          <div className="text-xs text-ink-faint">{r._assetCode ?? ''}</div>
        </div>
      ),
    },
    { key: 'expected', header: 'Expected', render: (r) => <span className="text-ink-muted">{`qty ${r.expected_quantity ?? '—'} · ${r._expectedLocation ?? '—'}`}</span> },
    {
      key: 'actual', header: 'Counted',
      render: (r) => r.actual_quantity == null
        ? <span className="text-ink-faint">—</span>
        : <span className="text-ink">{`qty ${r.actual_quantity} · ${r._actualLocation ?? '—'}`}</span>,
    },
    {
      key: 'result', header: 'Result', accessor: (r) => r.result,
      render: (r) => <Badge tone={RESULT_TONE[r.result]}>{label(r.result)}</Badge>,
    },
    { key: 'date', header: 'Counted on', render: (r) => <span className="text-xs text-ink-faint">{r.inventory_date ? new Date(r.inventory_date).toLocaleDateString() : '—'}</span> },
    {
      key: 'verified', header: 'Verified',
      render: (r) => r.is_verified ? <Badge tone="success">Verified</Badge> : <span className="text-xs text-ink-faint">—</span>,
    },
    {
      key: 'actions', header: '', width: '210px', align: 'right',
      render: (r) => (
        <div className="flex justify-end gap-1">
          {writable && (
            <Button variant="secondary" size="sm" onClick={() => onCount(r)}>
              <ClipboardCheck className="h-3.5 w-3.5" /> {r.result === 'not_inventoried' ? 'Count' : 'Re-count'}
            </Button>
          )}
          {canVerifyNow && !closed && r.result !== 'not_inventoried' && !r.is_verified && (
            <Button variant="ghost" size="sm" loading={verifyingId === r.id} onClick={() => onVerify(r, true)}>
              <CheckCheck className="h-3.5 w-3.5 text-success" /> Verify
            </Button>
          )}
          {canVerifyNow && !closed && r.is_verified && (
            <Button variant="ghost" size="sm" loading={verifyingId === r.id} onClick={() => onVerify(r, false)}>
              <Undo2 className="h-3.5 w-3.5 text-ink-faint" /> Unverify
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
          title={resultFilter ? 'No records match this filter' : 'No snapshot records'}
          description={resultFilter ? 'Try a different result filter.' : 'This cycle has no assets in its snapshot.'}
        />
      }
      toolbarActions={
        <div className="w-52">
          <SearchableSelect options={resultOptions} value={resultFilter} onChange={onResultFilter} placeholder="Filter by result" />
        </div>
      }
    />
  );
}
