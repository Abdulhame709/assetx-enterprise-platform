'use client';

/**
 * Audit event detail modal (Slice 4) — every field rendered from the real
 * event payload; absent values show an honest '—' (no invented data).
 */
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useI18n, formatDateTime } from '@/lib/i18n';
import { shortRef } from '@/lib/format';
import { AuditEventRow } from '../types';
import { actionTone } from '../badge-tones';

interface Props {
  open: boolean;
  event: AuditEventRow | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/60 py-2 last:border-0">
      <span className="shrink-0 text-xs text-ink-faint">{label}</span>
      <span className="break-all text-end text-sm text-ink">{value ?? '—'}</span>
    </div>
  );
}

export function AuditDetailModal({ open, event, onClose }: Props) {
  const { label, locale } = useI18n();
  if (!event) return null;
  const e = event;
  return (
    <Modal open={open} onClose={onClose} title={label(e.action_type)} size="md">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={actionTone(e.action_type)}>{label(e.action_type)}</Badge>
        {e.table_name ? <Badge tone="neutral">{e.table_name}</Badge> : null}
      </div>
      <div className="rounded-lg border border-line px-3">
        <Row label="Time" value={formatDateTime(e.created_at, locale)} />
        <Row label="Actor" value={shortRef('User', e.user_id)} />
        <Row label="Entity" value={e.table_name} />
        <Row label="Record" value={shortRef('Record', e.record_id)} />
        <Row label="IP address" value={e.ip_address} />
        <Row label="Geo" value={e.geo} />
        <Row label="Device" value={e.device_fingerprint} />
        <Row label="User agent" value={e.user_agent} />
      </div>
      {e.details ? (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-ink-faint">Details (raw payload)</p>
          <pre className="max-h-56 overflow-auto rounded-lg bg-surface-muted p-3 text-xs text-ink-muted">
            {JSON.stringify(e.details, null, 2)}
          </pre>
        </div>
      ) : null}
    </Modal>
  );
}
