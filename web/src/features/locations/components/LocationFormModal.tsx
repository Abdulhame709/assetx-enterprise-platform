'use client';

/**
 * LocationFormModal — create (root or child) / edit a location.
 * Validation mirrors backend rules (name ≥ 2 chars, duplicate name → server error).
 */
import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { humanError } from '@/lib/api/errors';
import { createLocation, updateLocation, LocationNode, LocationType } from '../api';
import { useI18n } from '@/lib/i18n';

const LOCATION_TYPES: LocationType[] = ['building', 'room', 'warehouse', 'workshop', 'outdoor'];

interface Props {
  open: boolean;
  /** null → create root · parent node → create child · node+isEdit → edit */
  mode: 'create-root' | 'create-child' | 'edit';
  parent?: LocationNode | null;
  node?: LocationNode | null;
  onClose: () => void;
  onSaved: () => void;
}

export function LocationFormModal({ open, mode, parent, node, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('room');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(mode === 'edit' ? node?.name ?? '' : '');
    setType(mode === 'edit' ? node?.location_type ?? 'room' : parent?.location_type === 'building' ? 'room' : (parent ? 'room' : 'building'));
    setError(null);
  }, [open, mode, node, parent]);

  const title =
    mode === 'edit' ? t('locationForm.editTitle').replace('{name}', node?.name ?? t('common.location')) :
    mode === 'create-child' ? t('locationForm.addChildTitle').replace('{name}', parent?.name ?? '') :
    t('locationForm.createRootTitle');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError(t('locationForm.nameTooShort')); return; }
    setSaving(true);
    try {
      if (mode === 'edit' && node) {
        await updateLocation(node.id, { name: name.trim(), location_type: type });
      } else {
        await createLocation({ name: name.trim(), location_type: type, parent_id: mode === 'create-child' ? parent?.id ?? null : null });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('locationForm.name')} hint={t('locationForm.nameHint')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required minLength={2} />
        </Field>
        <Field label={t('locationForm.type')}>
          <Select value={type} onChange={(e) => setType(e.target.value as LocationType)}>
            {LOCATION_TYPES.map((typeOption) => (
              <option key={typeOption} value={typeOption} className="capitalize">{t(`locationForm.type.${typeOption}`)}</option>
            ))}
          </Select>
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('locationForm.cancel')}</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            {mode === 'edit' ? t('locationForm.save') : t('locationForm.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
