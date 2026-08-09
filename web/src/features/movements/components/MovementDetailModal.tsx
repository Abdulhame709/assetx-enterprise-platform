'use client';

/**
 * Movement detail modal — read-only view of one movement + the approval
 * actions the backend exposes for `pending` rows.
 * Actions are delegated to the page-level handlers so there is exactly one
 * confirm/toast/reload flow (no duplicated lifecycle logic).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { useI18n, formatDateTime } from '@/lib/i18n';
import { shortRef } from '@/lib/format';
import { MovementRow, MovementType, MovementStatus } from '../api';

export const STATUS_TONE: Record<MovementStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const TYPE_VERB: Record<MovementType, string> = {
  transfer: 'Transfer',
  assignment: 'Assignment',
  return: 'Return',
  maintenance_return: 'Maintenance return',
  disposal: 'Disposal',
  retirement: 'Retirement',
};

interface Props {
  open: boolean;
  movement: MovementRow | null;
  onClose: () => void;
  canApprove: boolean;
  canReject: boolean;
  /** Page-level unified decision flow (confirm → PATCH → toast → reload). */
  onDecide: (movement: MovementRow, decision: 'approve' | 'reject') => Promise<void>;
  deciding: boolean;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-1.5 text-sm">
      <span className="shrink-0 text-ink-muted">{label}</span>
      <span className="text-end text-ink">{value ?? '—'}</span>
    </div>
  );
}

export function MovementDetailModal({ open, movement, onClose, canApprove, canReject, onDecide, deciding }: Props) {
  const { label } = useI18n();
  if (!movement) return null;
  const m = movement;
  const pending = m.status === 'pending';

  const transfer = (from: string | null | undefined, to: string | null | undefined) => (
    <span className="inline-flex items-center gap-1.5">
      <span>{from ?? '—'}</span>
      <ArrowRight className="h-3.5 w-3.5 text-ink-faint rtl:-scale-x-100" />
      <span className="font-medium">{to ?? '—'}</span>
    </span>
  );

  return (
    <Modal open={open} onClose={onClose} title={`${TYPE_VERB[m.movement_type]} request`} size="md"
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Close</Button>
          {pending && canReject && (
            <Button type="button" variant="danger" size="sm" loading={deciding}
              onClick={() => onDecide(m, 'reject')}>
              <XCircle className="h-4 w-4" /> Reject
            </Button>
          )}
          {pending && canApprove && (
            <Button type="button" variant="primary" size="sm" loading={deciding}
              onClick={() => onDecide(m, 'approve')}>
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          )}
        </>
      }>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{label(m.movement_type)}</Badge>
        <Badge tone={STATUS_TONE[m.status]}>{label(m.status)}</Badge>
        {m.reference_number && <Badge tone="info">{m.reference_number}</Badge>}
      </div>

      <div className="mb-4">
        <Link href={`/assets/${m.asset_id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
          {m._assetName ?? shortRef('Asset', m.asset_id)}
          {m._assetCode ? <span className="font-mono text-xs text-ink-faint">({m._assetCode})</span> : null}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="space-y-0">
        <Row label="Location" value={(m.from_location_id || m.to_location_id) ? transfer(m._fromLocation, m._toLocation) : null} />
        <Row label="Custodian" value={(m.from_employee_id || m.to_employee_id) ? transfer(m._fromEmployee, m._toEmployee) : null} />
        <Row label="Status change" value={(m.from_status_id || m.to_status_id) ? transfer(m._fromStatus, m._toStatus) : null} />
        <Row label="Quantity" value={m.quantity != null ? String(m.quantity) : null} />
        <Row label="Reason" value={m.reason} />
        <Row label="Notes" value={m.notes} />
        <Row label="Requested by" value={m.performed_by ? shortRef('User', m.performed_by) : null} />
        <Row label="Requested at" value={formatDateTime(m.created_at)} />
        <Row label="Decided by" value={m.approved_by ? shortRef('User', m.approved_by) : null} />
        <Row label="Decided at" value={m.approved_at ? formatDateTime(m.approved_at) : null} />
      </div>

      {pending && (canApprove || canReject) && (
        <p className="mt-4 rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-muted">
          Approving applies this movement&apos;s effect to the asset. Rejecting leaves the asset unchanged.
        </p>
      )}
    </Modal>
  );
}
