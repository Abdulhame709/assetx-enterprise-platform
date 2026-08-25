'use client';

/**
 * LocationFormModal — create (root or child) / edit a location.
 * Type options are tenant-scoped location-type records loaded from Settings.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { humanError } from '@/lib/api/errors';
import { createLocation, updateLocation, LocationNode, LocationType } from '../api';
import type { LocationTypeOption } from '@/features/location-types/api';
import { useI18n } from '@/lib/i18n';

interface Props {
  open: boolean;
  /** null → create root · parent node → create child · node+isEdit → edit */
  mode: 'create-root' | 'create-child' | 'edit';
  parent?: LocationNode | null;
  node?: LocationNode | null;
  locationTypes: LocationTypeOption[];
  onClose: () => void;
  onSaved: () => void;
}

export function LocationFormModal({ open, mode, parent, node, locationTypes, onClose, onSaved }: Props) {
  const { t, locale } = useI18n();
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const availableTypes = useMemo(() => {
    const currentCode = mode === 'edit' ? node?.location_type : null;
    const active = locationTypes.filter((item) => item.is_active || item.code === currentCode);
    return active;
  }, [locationTypes, mode, node?.location_type]);

  useEffect(() => {
    if (!open) return;
    setName(mode === 'edit' ? node?.name ?? '' : '');
    const current = mode === 'edit' ? node?.location_type : null;
    const preferred = current
      ?? (parent?.location_type === 'building' ? availableTypes.find((item) => item.code === 'room')?.code : null)
      ?? availableTypes.find((item) => item.code === 'building')?.code
      ?? availableTypes[0]?.code
      ?? '';
    setType(preferred);
    setError(null);
  }, [open, mode, node, parent, availableTypes]);

  const title =
    mode === 'edit' ? t('locationForm.editTitle').replace('{name}', node?.name ?? t('common.location')) :
    mode === 'create-child' ? t('locationForm.addChildTitle').replace('{name}', parent?.name ?? '') :
    t('locationForm.createRootTitle');

  const typeLabel = (option: LocationTypeOption) => locale === 'ar'
    ? option.name_ar
    : option.name_en ?? option.name_ar;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError(t('locationForm.nameTooShort')); return; }
    if (!type) { setError(t('locationForm.typeRequired')); return; }
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
        <Field label={t('locationForm.type')} hint={t('locationForm.typeSettingsHint')}>
          <Select value={type} onChange={(e) => setType(e.target.value)} disabled={availableTypes.length === 0}>
            {availableTypes.map((typeOption) => (
              <option key={typeOption.code} value={typeOption.code}>{typeLabel(typeOption)}</option>
            ))}
          </Select>
        </Field>
        {availableTypes.length === 0 && <p className="text-sm text-danger">{t('locationForm.noTypes')}</p>}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('locationForm.cancel')}</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving} disabled={availableTypes.length === 0}>
            {mode === 'edit' ? t('locationForm.save') : t('locationForm.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
