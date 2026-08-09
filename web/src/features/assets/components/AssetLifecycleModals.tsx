'use client';

/**
 * Asset lifecycle action modals — transfer / dispose / retire.
 * Transfer applies immediately (POST /assets/:id/transfer) + records history.
 * Dispose/retire create PENDING movement records applied only on approval (ADR-007),
 * decided from the Movements page (/movements · pending approvals inbox).
 */
import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/form';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { humanError } from '@/lib/api/errors';
import { getEmployees, ReferenceEmployee } from '@/features/reference/api';
import { getLocationsTree } from './reference-selects';
import { transferAsset, disposeAsset, retireAsset } from '../api';

interface BaseProps {
  open: boolean;
  assetId: string;
  assetName: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function TransferAssetModal({ open, assetId, assetName, onClose, onDone }: BaseProps) {
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([]);
  const [employees, setEmployees] = useState<ReferenceEmployee[]>([]);
  const [toLocation, setToLocation] = useState<string | null>(null);
  const [toEmployee, setToEmployee] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setToLocation(null); setToEmployee(null); setReason(''); setError(null);
    Promise.all([getLocationsTree().then(setLocations), getEmployees().then(setEmployees)])
      .catch((err) => setError(humanError(err, 'Could not load options.')));
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!toLocation && !toEmployee) {
      setError('Choose a destination location and/or a new custodian.');
      return;
    }
    setSaving(true);
    try {
      await transferAsset(assetId, {
        to_location_id: toLocation || undefined,
        to_employee_id: toEmployee || undefined,
        reason: reason.trim() || undefined,
      });
      onDone('Asset transferred and the movement was recorded.');
      onClose();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Transfer ${assetName}`} size="md">
      <p className="mb-4 rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-muted">
        The asset is moved immediately and the transfer is recorded as a movement (append-only history).
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="To location">
          <SearchableSelect options={locations} value={toLocation} onChange={setToLocation} placeholder="Choose destination…" />
        </Field>
        <Field label="New custodian">
          <SearchableSelect
            options={employees.map((p) => ({ value: p.id, label: p.department ? `${p.name} · ${p.department}` : p.name }))}
            value={toEmployee}
            onChange={setToEmployee}
            placeholder="Optional…"
          />
        </Field>
        <Field label="Reason">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is the asset being transferred?" />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>Create transfer</Button>
        </div>
      </form>
    </Modal>
  );
}

export function EndOfLifeModal({
  open, kind, assetId, assetName, onClose, onDone,
}: BaseProps & { kind: 'dispose' | 'retire' }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setReason(''); setError(null); } }, [open]);

  const verb = kind === 'dispose' ? 'Dispose' : 'Retire';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (kind === 'dispose') await disposeAsset(assetId, reason.trim() || undefined);
      else await retireAsset(assetId, reason.trim() || undefined);
      onDone(`${verb} request created. The asset is deactivated after approval.`);
      onClose();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${verb} ${assetName}`} size="sm">
      <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
        This creates a {verb} movement. After approval the asset is deactivated and removed from operations.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Reason">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={`Why is the asset being ${kind === 'dispose' ? 'disposed' : 'retired'}?`} />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" size="sm" loading={saving}>Confirm {verb.toLowerCase()}</Button>
        </div>
      </form>
    </Modal>
  );
}
