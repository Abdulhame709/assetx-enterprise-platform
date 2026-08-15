'use client';

/**
 * Movements — operational movement list + approvals inbox (real backend contract).
 * Data: GET /search/movements (paged, server-filtered) · approve/reject via
 * PATCH /movements/:id/{approve,reject}. The backend is authoritative for all
 * state changes; this page only reflects and refreshes.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight, ArrowRightLeft, UserCheck, RotateCcw, Wrench, Trash2, Archive,
  Eye, Check, X, Download,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/states';
import { EnterpriseTable, EColumn } from '@/components/ui/EnterpriseTable';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Input } from '@/components/ui/form';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useCan } from '@/lib/auth/session-context';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { humanError } from '@/lib/api/errors';
import { useI18n, formatDateTime } from '@/lib/i18n';
import { shortRef } from '@/lib/format';
import { useMovements } from '@/features/movements/use-movements';
import {
  MovementRow, MovementType, MOVEMENT_TYPES, MovementFilter, DEFAULT_FILTER,
  approveMovement, rejectMovement, downloadMovementsExport,
} from '@/features/movements/api';
import { MovementDetailModal, STATUS_TONE } from '@/features/movements/components/MovementDetailModal';

type StatusTab = 'pending' | 'all' | 'approved' | 'rejected';

const TYPE_ICON: Record<MovementType, typeof ArrowRightLeft> = {
  transfer: ArrowRightLeft,
  assignment: UserCheck,
  return: RotateCcw,
  maintenance_return: Wrench,
  disposal: Trash2,
  retirement: Archive,
};

const TYPE_TONE: Record<MovementType, BadgeTone> = {
  transfer: 'brand',
  assignment: 'info',
  return: 'neutral',
  maintenance_return: 'warning',
  disposal: 'danger',
  retirement: 'danger',
};

function RouteCell({ m }: { m: MovementRow }) {
  const hasLoc = m.from_location_id || m.to_location_id;
  const hasEmp = m.from_employee_id || m.to_employee_id;
  if (!hasLoc && !hasEmp) return <span className="text-ink-faint">—</span>;
  const from = hasLoc ? (m._fromLocation ?? '—') : (m._fromEmployee ?? '—');
  const to = hasLoc ? (m._toLocation ?? '—') : (m._toEmployee ?? '—');
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 text-xs">
      <span className="truncate text-ink-muted">{from}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-faint rtl:-scale-x-100" />
      <span className="truncate font-medium text-ink">{to}</span>
    </span>
  );
}

export default function MovementsPage() {
  const [tab, setTab] = useState<StatusTab>('pending');
  const [type, setType] = useState<'all' | MovementType>('all');
  const [assetId, setAssetId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MovementRow | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const { label, t, locale } = useI18n();
  const toast = useToast();
  const { confirm } = useConfirm();
  const can = useCan();

  const filter: MovementFilter = {
    ...DEFAULT_FILTER,
    status: tab,
    movement_type: type,
    asset_id: assetId,
    created_at_from: dateFrom || null,
    created_at_to: dateTo || null,
    page,
  };
  const state = useMovements(filter);

  const canApprove = can(PERMISSIONS.MOVEMENT_APPROVE);
  const canReject = can(PERMISSIONS.MOVEMENT_REJECT);
  const data = state.data;
  const rows = data?.page.items ?? [];

  const filtered =
    tab !== 'pending' ||
    type !== 'all' ||
    assetId !== null ||
    dateFrom !== '' ||
    dateTo !== '';

  const resetPage = () => setPage(1);
  const onTab = (t: StatusTab) => { setTab(t); resetPage(); };
  const onType = (v: string | null) => { setType((v ?? 'all') as 'all' | MovementType); resetPage(); };

  /** Unified decision flow: confirm → PATCH → toast → reload (backend authoritative). */
  const decide = async (m: MovementRow, decision: 'approve' | 'reject') => {
    const approve = decision === 'approve';
    const ok = await confirm({
      title: (approve ? t('movements.approvePrompt') : t('movements.rejectPrompt')).replace('{type}', label(m.movement_type)),
      message: approve
        ? t('movements.applyEffect').replace('{asset}', m._assetName ?? shortRef(t('movements.asset'), m.asset_id))
        : t('movements.noChange').replace('{asset}', m._assetName ?? shortRef(t('movements.asset'), m.asset_id)),
      tone: approve ? 'default' : 'danger',
      confirmLabel: approve ? t('movements.approve') : t('movements.reject'),
    });
    if (!ok) return;
    setDecidingId(m.id);
    try {
      if (approve) await approveMovement(m.id);
      else await rejectMovement(m.id);
      toast.success(
        approve ? t('movements.approvedToast') : t('movements.rejectedToast'),
        approve ? t('movements.effectApplied') : t('movements.noChanges'),
      );
      setSelected(null);
      state.reload();
    } catch (err) {
      toast.error(t('movements.actionFailed'), humanError(err));
      setSelected(null);
      state.reload(); // e.g. MOVEMENT_NOT_PENDING — refresh stale row
    } finally {
      setDecidingId(null);
    }
  };

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadMovementsExport('csv');
      toast.success(t('movements.exportReady'), t('movements.exportDownloaded'));
    } catch (err) {
      toast.error(t('movements.exportFailed'), humanError(err));
    } finally {
      setExporting(false);
    }
  };

  const typeOptions = useMemo(
    () => [{ value: 'all', label: t('movements.allTypes') }, ...MOVEMENT_TYPES.map((movementType) => ({ value: movementType, label: label(movementType) }))],
    [label, t],
  );
  const assetOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    data?.lookups.assets.forEach((v, k) => opts.push({ value: k, label: v.code ? `${v.name} · ${v.code}` : v.name }));
    return opts;
  }, [data]);

  const columns: EColumn<MovementRow>[] = [
    {
      key: 'movement_type',
      header: t('movements.type'),
      render: (m) => {
        const Icon = TYPE_ICON[m.movement_type] ?? ArrowRightLeft;
        return (
          <span className="inline-flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${
              m.movement_type === 'disposal' || m.movement_type === 'retirement' ? 'bg-danger/10 text-danger' : 'bg-surface-muted text-ink-muted'
            }`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <Badge tone={TYPE_TONE[m.movement_type] ?? 'neutral'}>{label(m.movement_type)}</Badge>
          </span>
        );
      },
    },
    {
      key: 'asset',
      header: t('movements.asset'),
      render: (m) => (
        <Link href={`/assets/${m.asset_id}`} className="group block min-w-0">
          <span className="block truncate text-sm font-medium text-brand group-hover:underline">
            {m._assetName ?? shortRef(t('movements.asset'), m.asset_id)}
          </span>
          <span className="block font-mono text-[11px] text-ink-faint">{m._assetCode ?? ''}</span>
        </Link>
      ),
    },
    { key: 'route', header: t('movements.fromTo'), render: (m) => <RouteCell m={m} />, width: '220px' },
    {
      key: 'reason',
      header: t('movements.reasonRef'),
      render: (m) => (
        <span className="block max-w-[220px] truncate text-xs text-ink-muted" title={m.reason ?? m.reference_number ?? ''}>
          {m.reason ?? m.reference_number ?? '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: t('movements.requested'),
      render: (m) => (
        <div className="text-xs">
          <div className="text-ink">{formatDateTime(m.created_at)}</div>
          <div className="text-ink-faint">{t('movements.by')} {shortRef(t('movements.by'), m.performed_by)}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('movements.status'),
      render: (m) => <Badge tone={STATUS_TONE[m.status]}>{label(m.status)}</Badge>,
    },
    {
      key: 'approved_at',
      header: t('movements.decided'),
      render: (m) => (
        <div className="text-xs text-ink-muted">
          {m.approved_at ? formatDateTime(m.approved_at) : '—'}
          {m.approved_by ? <div className="text-ink-faint">{t('movements.by')} {shortRef(t('movements.by'), m.approved_by)}</div> : null}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '120px',
      render: (m) => (
        <div className="flex items-center justify-end gap-1">
          {m.status === 'pending' && canApprove && (
            <Button variant="ghost" size="sm" aria-label={`${t('movements.approve')} ${label(m.movement_type)}`}
              loading={decidingId === m.id}
              onClick={() => decide(m, 'approve')}>
              <Check className="h-4 w-4 text-success" />
            </Button>
          )}
          {m.status === 'pending' && canReject && (
            <Button variant="ghost" size="sm" aria-label={`${t('movements.reject')} ${label(m.movement_type)}`}
              loading={decidingId === m.id}
              onClick={() => decide(m, 'reject')}>
              <X className="h-4 w-4 text-danger" />
            </Button>
          )}
          <Button variant="ghost" size="sm" aria-label={t('movements.view')} onClick={() => setSelected(m)}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('movements.title')}
        subtitle={
          data
            ? t('movements.summary').replace('{pending}', data.pendingTotal.toLocaleString(locale)).replace('{total}', data.page.total.toLocaleString(locale))
            : t('movements.subtitle')
        }
        actions={
          <PermissionGate permission={PERMISSIONS.EXPORT_MOVEMENTS}>
            <Button variant="secondary" size="sm" onClick={onExport} loading={exporting}>
              <Download className="h-4 w-4" /> {t('movements.exportCsv')}
            </Button>
          </PermissionGate>
        }
      />

      <div className="mb-3">
        <Tabs items={[
          { id: 'pending', label: t('movements.pending') }, { id: 'all', label: t('movements.all') },
          { id: 'approved', label: t('movements.approved') }, { id: 'rejected', label: t('movements.rejected') },
        ]} value={tab} onChange={onTab} />
      </div>

      <Card className="p-0">
        <CardBody className="p-0">
          <EnterpriseTable
            columns={columns}
            rows={rows}
            rowKey={(m) => m.id}
            loading={state.status === 'loading'}
            error={state.status === 'error' ? humanError(state.error) : null}
            onRetry={state.reload}
            page={page}
            pageSize={filter.limit}
            total={data?.page.total ?? rows.length}
            onPageChange={setPage}
            searchable={false}
            empty={
              <EmptyState
                title={tab === 'pending' && !filtered ? t('movements.nonePending') : t('movements.none')}
                description={
                  tab === 'pending' && !filtered
                    ? t('movements.nonePendingDesc')
                    : t('movements.noneDesc')
                }
              />
            }
            toolbarActions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <SearchableSelect options={typeOptions} value={type} onChange={onType} placeholder={t('movements.filterType')} />
                </div>
                <div className="w-56">
                  <SearchableSelect
                    options={assetOptions}
                    value={assetId}
                    onChange={(v) => { setAssetId(v); resetPage(); }}
                    placeholder={t('movements.allAssets')}
                    clearable
                  />
                </div>
                <Input
                  type="date"
                  className="w-36"
                  value={dateFrom}
                  aria-label={t('movements.fromDate')}
                  onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
                />
                <span className="text-xs text-ink-faint">{t('movements.toDate')}</span>
                <Input
                  type="date"
                  className="w-36"
                  value={dateTo}
                  aria-label={t('movements.toDate')}
                  onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
                />
              </div>
            }
          />
        </CardBody>
      </Card>

      {selected && (
        <MovementDetailModal
          open
          movement={selected}
          onClose={() => setSelected(null)}
          canApprove={canApprove}
          canReject={canReject}
          deciding={decidingId === selected.id}
          onDecide={decide}
        />
      )}
    </div>
  );
}
