'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/form';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';
import { bulkUpdateAssets, BulkAssetUpdateInput, BulkAssetUpdateResult } from '../api';

type FieldName = 'location_id' | 'employee_id' | 'status_id' | 'notes';
type Option = { value: string; label: string };

interface Props {
  open: boolean;
  assetIds: string[];
  locations: Option[];
  employees: Option[];
  statuses: Option[];
  onClose: () => void;
  onSaved: (result: BulkAssetUpdateResult) => void;
}

export function AssetBulkEditModal({ open, assetIds, locations, employees, statuses, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [field, setField] = useState<FieldName>('location_id');
  const [value, setValue] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setField('location_id');
    setValue(null);
    setNotes('');
    setError(null);
  }, [open]);

  const options = field === 'location_id' ? locations : field === 'employee_id' ? employees : statuses;
  const fieldLabel: Record<FieldName, string> = {
    location_id: t('assetActions.bulkLocation'),
    employee_id: t('assetActions.bulkCustodian'),
    status_id: t('assetActions.bulkStatus'),
    notes: t('assetActions.bulkNotes'),
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (field !== 'notes' && !value) {
      setError(t('assetActions.bulkValue'));
      return;
    }
    const input: BulkAssetUpdateInput = { asset_ids: assetIds };
    if (field === 'notes') input.notes = notes;
    if (field === 'location_id') input.location_id = value ?? undefined;
    if (field === 'employee_id') input.employee_id = value === '__clear__' ? null : value;
    if (field === 'status_id') input.status_id = value ?? undefined;
    setSaving(true);
    try {
      const result = await bulkUpdateAssets(input);
      onSaved(result);
      onClose();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`${t('assetActions.bulkEdit')} (${assetIds.length})`} size="md">
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-surface-subtle px-3 py-2 text-sm text-ink-muted">{assetIds.length} {t('common.assets')}</p>
        <Field label={t('assetActions.bulkField')}>
          <Select value={field} onChange={(event) => { setField(event.target.value as FieldName); setValue(null); setNotes(''); }}>
            <option value="location_id">{t('assetActions.bulkLocation')}</option>
            <option value="employee_id">{t('assetActions.bulkCustodian')}</option>
            <option value="status_id">{t('assetActions.bulkStatus')}</option>
            <option value="notes">{t('assetActions.bulkNotes')}</option>
          </Select>
        </Field>
        {field === 'notes' ? (
          <Field label={t('assetActions.bulkValue')}>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        ) : (
          <Field label={t('assetActions.bulkValue')} error={error ?? undefined}>
            <SearchableSelect
              options={field === 'employee_id' ? [{ value: '__clear__', label: '—' }, ...options] : options}
              value={value}
              onChange={setValue}
              placeholder={fieldLabel[field]}
            />
          </Field>
        )}
        {field === 'notes' && error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>{t('assetActions.bulkApply')}</Button>
        </div>
      </form>
    </Modal>
  );
}
