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

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (cycle: { id: string; year: number }, snapshotCount: number) => void;
}

type ScopeKind = 'all' | 'location' | 'category';

export function CycleFormModal({ open, onClose, onCreated }: Props) {
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
    if (!y || y < 2000 || y > 2100) { setError('Year must be between 2000 and 2100.'); return; }
    if (scopeKind === 'location' && !locationId) { setError('Choose a location for the scope.'); return; }
    if (scopeKind === 'category' && !categoryId) { setError('Choose an asset type for the scope.'); return; }
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
    <Modal open={open} onClose={onClose} title="New Inventory Cycle" size="md">
      <p className="mb-4 rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-muted">
        Creating a cycle snapshots the matching active assets as expected records (name, location, quantity, status, custodian).
      </p>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Year" hint="One cycle per year per tenant.">
          <Input type="number" min={2000} max={2100} value={year} onChange={(e) => setYear(e.target.value)} required />
        </Field>
        <Field label="Scope" hint="Which assets enter the snapshot.">
          <Select value={scopeKind} onChange={(e) => setScopeKind(e.target.value as ScopeKind)}>
            <option value="all">All active assets</option>
            <option value="location">Location (includes children)</option>
            <option value="category">Asset type</option>
          </Select>
        </Field>
        {scopeKind === 'location' && (
          <Field label="Location">
            <SearchableSelect options={locations} value={locationId} onChange={setLocationId} placeholder="Choose location…" />
          </Field>
        )}
        {scopeKind === 'category' && (
          <Field label="Asset type">
            <SearchableSelect options={categories} value={categoryId} onChange={setCategoryId} placeholder="Choose type…" />
          </Field>
        )}
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>Create cycle</Button>
        </div>
      </form>
    </Modal>
  );
}
