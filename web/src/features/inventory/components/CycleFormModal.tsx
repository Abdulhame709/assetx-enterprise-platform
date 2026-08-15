'use client';

/**
 * CycleFormModal — create an inventory cycle (BR-INV-001: snapshot on create).
 * Scope options mirror backend CycleScopeDto exactly: all / location / category.
 */
import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { humanError } from '@/lib/api/errors';
import { getLocationsTree } from '@/features/assets/components/reference-selects';
import { getCategories } from '@/features/assets/api';
import { createCycle } from '../api';
import { useI18n } from '@/lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (cycle: { id: string; year: number }, snapshotCount: number) => void;
}

type ScopeKind = 'all' | 'location' | 'category';

export function CycleFormModal({ open, onClose, onCreated }: Props) {
  const { t } = useI18n();
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [scopeKind, setScopeKind] = useState<ScopeKind>('all');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setYear(String(new Date().getFullYear()));
    setScopeKind('all');
    setLocationId(null);
    setCategoryId(null);
    setError(null);
    getLocationsTree().then(setLocations).catch(() => undefined);
    getCategories().then(setCategories).catch(() => undefined);
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const y = Number(year);
    if (!y || y < 2000 || y > 2100) { setError(t('inventoryForm.yearInvalid')); return; }
    if (scopeKind === 'location' && !locationId) { setError(t('inventoryForm.locationRequired')); return; }
    if (scopeKind === 'category' && !categoryId) { setError(t('inventoryForm.categoryRequired')); return; }
    setSaving(true);
    try {
      const { cycle, snapshotCount } = await createCycle({
        year: y,
        scope: scopeKind === 'all' ? { all: true } : scopeKind === 'location' ? { location_id: locationId } : { category_id: categoryId },
      });
      onCreated({ id: cycle.id, year: cycle.year }, snapshotCount);
      onClose();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('inventoryForm.newCycle')} size="md">
      <p className="mb-4 rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-muted">
        {t('inventoryForm.snapshotNotice')}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('inventoryForm.year')} hint={t('inventoryForm.yearHint')}>
          <Input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} required />
        </Field>
        <Field label={t('inventoryForm.scope')} hint={t('inventoryForm.scopeHint')}>
          <Select value={scopeKind} onChange={(e) => setScopeKind(e.target.value as ScopeKind)}>
            <option value="all">{t('inventoryForm.allAssets')}</option>
            <option value="location">{t('inventoryForm.locationScope')}</option>
            <option value="category">{t('inventoryForm.categoryScope')}</option>
          </Select>
        </Field>
        {scopeKind === 'location' && (
          <Field label={t('inventoryForm.location')}>
            <SearchableSelect options={locations} value={locationId} onChange={setLocationId} placeholder={t('inventoryForm.chooseLocation')} />
          </Field>
        )}
        {scopeKind === 'category' && (
          <Field label={t('inventoryForm.assetType')}>
            <SearchableSelect options={categories} value={categoryId} onChange={setCategoryId} placeholder={t('inventoryForm.chooseType')} />
          </Field>
        )}
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('inventoryForm.cancel')}</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>{t('inventoryForm.create')}</Button>
        </div>
      </form>
    </Modal>
  );
}
