'use client';

/**
 * Audit (Slice 4) — operational audit trail on the REAL backend contracts:
 *   /audit/events (all) · /audit/security (auth/permission) · /exports/audit
 * Honest by construction: empty cells render '—', no synthesized values.
 */
import { useState } from 'react';
import { Download, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { EmptyState } from '@/components/ui/states';
import { EnterpriseTable, EColumn } from '@/components/ui/EnterpriseTable';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useToast } from '@/components/ui/Toast';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useI18n, formatDateTime } from '@/lib/i18n';
import { shortRef } from '@/lib/format';
import { humanError } from '@/lib/api/errors';
import { AuditEventRow, AuditTab } from '@/features/audit/types';
import { useAuditEvents } from '@/features/audit/use-audit';
import { downloadAuditExport } from '@/features/audit/api';
import { AuditDetailModal } from '@/features/audit/components/AuditDetailModal';
import { actionTone } from '@/features/audit/badge-tones';

/** Backend action catalog (mirrors backend/src/core/constants/audit-events.ts). */
const ACTION_KEYS = [
  'AUTH_LOGIN_SUCCESS', 'AUTH_LOGIN_FAILED', 'AUTH_LOGOUT', 'AUTH_TOKEN_REFRESH', 'AUTH_REGISTER', 'AUTH_PASSWORD_RESET',
  'PERMISSION_GRANTED', 'PERMISSION_DENIED', 'PERMISSION_CHANGED',
  'ASSET_CREATED', 'ASSET_UPDATED', 'ASSET_DELETED', 'ASSET_STATUS_CHANGED',
  'MOVEMENT_CREATED', 'MOVEMENT_APPROVED', 'MOVEMENT_REJECTED',
  'INVENTORY_CREATED', 'INVENTORY_STARTED', 'INVENTORY_CLOSED', 'INVENTORY_RECORD_VERIFIED',
  'COMPLIANCE_WARNING',
  'EXPORT_STARTED', 'EXPORT_COMPLETED', 'EXPORT_FAILED',
  'SAVED_SEARCH_CREATED', 'SAVED_SEARCH_UPDATED', 'SAVED_SEARCH_DELETED', 'SAVED_SEARCH_EXECUTED',
  'API_REQUEST',
];

/** Entity (table_name) domains observed in the live stream. */
const ENTITY_KEYS = ['auth', 'permission', 'asset', 'movement', 'inventory', 'compliance', 'export', 'saved_search'];

const PAGE_SIZE = 25;

export default function AuditPage() {
  const { label, locale } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<AuditTab>('all');
  const [action, setAction] = useState<string | null>(null);
  const [entity, setEntity] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditEventRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const state = useAuditEvents(tab, {
    action, entity,
    date_from: dateFrom || null,
    date_to: dateTo || null,
    page, limit: PAGE_SIZE,
  });

  const setFilter = (fn: () => void) => { fn(); setPage(1); };

  const columns: EColumn<AuditEventRow>[] = [
    {
      key: 'created_at', header: 'Time', width: '170px',
      render: (r) => <span className="text-xs text-ink-muted">{formatDateTime(r.created_at, locale)}</span>,
    },
    {
      key: 'action_type', header: 'Action',
      render: (r) => <Badge tone={actionTone(r.action_type)}>{label(r.action_type)}</Badge>,
    },
    {
      key: 'table_name', header: 'Entity', width: '110px',
      render: (r) => r.table_name ? <Badge tone="neutral">{r.table_name}</Badge> : <span className="text-ink-faint">—</span>,
    },
    {
      key: 'record_id', header: 'Record',
      render: (r) => <span className="text-xs text-ink-muted">{shortRef('Record', r.record_id)}</span>,
    },
    {
      key: 'user_id', header: 'Actor',
      render: (r) => <span className="text-xs text-ink-muted">{shortRef('User', r.user_id)}</span>,
    },
    {
      key: 'details', header: 'Details',
      render: (r) => {
        const d = r.details as { endpoint?: string; method?: string; reason?: string } | null;
        const text = d?.endpoint ? `${d.method ?? ''} ${d.endpoint}`.trim() : d?.reason ?? '';
        return <span className="block max-w-[240px] truncate text-xs text-ink-muted" title={text}>{text || '—'}</span>;
      },
    },
    {
      key: 'view', header: '', align: 'right', width: '48px',
      render: (r) => (
        <Button variant="ghost" size="sm" aria-label="View event" onClick={() => setSelected(r)}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadAuditExport();
      toast.success('Export downloaded', 'Audit CSV was generated from live data.');
    } catch (err) {
      toast.error('Export failed', humanError(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <PermissionGate
      permission={PERMISSIONS.AUDIT_VIEW}
      fallback={<EmptyState title="No audit access" description="Your role does not grant audit.view." />}
    >
      <PageHeader
        title="Audit"
        subtitle={`${state.data?.total?.toLocaleString() ?? '—'} events recorded`}
        actions={
          <PermissionGate permission={PERMISSIONS.EXPORT_AUDIT}>
            <Button variant="secondary" size="sm" onClick={() => void onExport()} loading={exporting}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
          </PermissionGate>
        }
      />

      <div className="mb-4">
        <Tabs
          items={[
            { id: 'all', label: 'All events' },
            { id: 'security', label: 'Security' },
          ]}
          value={tab}
          onChange={(k) => { setTab(k as AuditTab); setPage(1); }}
        />
      </div>

      <Card className="p-0">
        <CardBody className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-muted/40 px-3 py-2">
            <div className="w-full sm:w-60">
              <SearchableSelect
                options={ACTION_KEYS.map((k) => ({ value: k, label: label(k) }))}
                value={action}
                onChange={(v) => setFilter(() => setAction(v))}
                placeholder="All actions"
              />
            </div>
            <div className="w-full sm:w-44">
              <SearchableSelect
                options={ENTITY_KEYS.map((k) => ({ value: k, label: k }))}
                value={entity}
                onChange={(v) => setFilter(() => setEntity(v))}
                placeholder="All entities"
              />
            </div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setFilter(() => setDateFrom(e.target.value))}
              className="ax-input w-full py-1.5 sm:w-40"
              aria-label="From date"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setFilter(() => setDateTo(e.target.value))}
              className="ax-input w-full py-1.5 sm:w-40"
              aria-label="To date"
            />
          </div>
          <AsyncBoundary state={state}>
            {(data) => (
              <EnterpriseTable<AuditEventRow>
                columns={columns}
                rows={data.items}
                rowKey={(r) => r.id}
                page={page}
                pageSize={PAGE_SIZE}
                total={data.total}
                onPageChange={setPage}
                searchable={false}
                empty={<EmptyState title="No audit events" description="No events match the current filters." />}
              />
            )}
          </AsyncBoundary>
        </CardBody>
      </Card>

      <AuditDetailModal open={selected != null} event={selected} onClose={() => setSelected(null)} />
    </PermissionGate>
  );
}
