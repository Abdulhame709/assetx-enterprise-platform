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
import { useI18n } from '@/lib/i18n';

interface BaseProps {
  open: boolean;
  assetId: string;
  assetName: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function TransferAssetModal({ open, assetId, assetName, onClose, onDone }: BaseProps) {
  const { t } = useI18n();
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
      .catch((err) => setError(humanError(err, t('assetLifecycle.loadOptionsFailed'))));
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!toLocation && !toEmployee) {
      setError(t('assetLifecycle.chooseDestination'));
      return;
    }
    setSaving(true);
    try {
      await transferAsset(assetId, {
        to_location_id: toLocation || undefined,
        to_employee_id: toEmployee || undefined,
        reason: reason.trim() || undefined,
      });
      onDone(t('assetLifecycle.transferComplete'));
      onClose();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('assetLifecycle.transferTitle').replace('{name}', assetName)} size="md">
      <p className="mb-4 rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-muted">
        {t('assetLifecycle.transferNotice')}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('assetLifecycle.toLocation')}>
          <SearchableSelect options={locations} value={toLocation} onChange={setToLocation} placeholder={t('assetLifecycle.destinationPlaceholder')} />
        </Field>
        <Field label={t('assetLifecycle.newCustodian')}>
          <SearchableSelect
            options={employees.map((p) => ({ value: p.id, label: p.department ? `${p.name} · ${p.department}` : p.name }))}
            value={toEmployee}
            onChange={setToEmployee}
            placeholder={t('assetLifecycle.optional')}
          />
        </Field>
        <Field label={t('assetLifecycle.reason')}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('assetLifecycle.transferReason')} />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('assetLifecycle.cancel')}</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>{t('assetLifecycle.createTransfer')}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function EndOfLifeModal({
  open, kind, assetId, assetName, onClose, onDone,
}: BaseProps & { kind: 'dispose' | 'retire' }) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setReason(''); setError(null); } }, [open]);

  const verb = kind === 'dispose' ? t('assetLifecycle.dispose') : t('assetLifecycle.retire');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (kind === 'dispose') await disposeAsset(assetId, reason.trim() || undefined);
      else await retireAsset(assetId, reason.trim() || undefined);
      onDone(t('assetLifecycle.requestCreated').replace('{verb}', verb));
      onClose();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('assetLifecycle.endOfLifeTitle').replace('{verb}', verb).replace('{name}', assetName)} size="sm">
      <p className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">
        {t('assetLifecycle.endOfLifeNotice').replace('{verb}', verb)}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('assetLifecycle.reason')}>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('assetLifecycle.endOfLifeReason').replace('{verb}', verb)} />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('assetLifecycle.cancel')}</Button>
          <Button type="submit" variant="danger" size="sm" loading={saving}>{t('assetLifecycle.confirm').replace('{verb}', verb)}</Button>
        </div>
      </form>
    </Modal>
  );
}
