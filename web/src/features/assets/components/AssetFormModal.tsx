'use client';

/**
 * AssetFormModal — create/edit an asset with REAL validation + REAL submission.
 * Rules mirror AssetService.validateCreate: name ≥ 2, category/location/status
 * required, quantity > 0, price ≥ 0, depreciation 0–100.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { humanError } from '@/lib/api/errors';
import { getStatuses, getEmployees, getModels, ReferenceEmployee, ReferenceModel, ReferenceStatus } from '@/features/reference/api';
import { getCategories } from '../api';
import { getLocationsTree } from './reference-selects';
import { createAsset, updateAsset, AssetDetail } from '../api';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  asset?: AssetDetail | null;
  onClose: () => void;
  onSaved: (asset: AssetDetail, verb: 'created' | 'updated') => void;
}

interface FormState {
  name: string;
  description: string;
  category_id: string | null;
  location_id: string | null;
  status_id: string;
  employee_id: string | null;
  model_id: string | null;
  quantity: string;
  purchase_price: string;
  purchase_date: string;
  serial_number: string;
  barcode: string;
  notes: string;
}

const EMPTY: FormState = {
  name: '', description: '', category_id: null, location_id: null, status_id: '',
  employee_id: null, model_id: null, quantity: '1', purchase_price: '', purchase_date: '',
  serial_number: '', barcode: '', notes: '',
};

export function AssetFormModal({ open, mode, asset, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([]);
  const [statuses, setStatuses] = useState<ReferenceStatus[]>([]);
  const [employees, setEmployees] = useState<ReferenceEmployee[]>([]);
  const [models, setModels] = useState<ReferenceModel[]>([]);
  const [refError, setRefError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError(null);
    if (mode === 'edit' && asset) {
      setForm({
        name: asset.name ?? '',
        description: asset.description ?? '',
        category_id: asset.category_id ?? null,
        location_id: asset.location_id ?? null,
        status_id: asset.status_id ?? '',
        employee_id: asset.employee_id ?? null,
        model_id: asset.model_id ?? null,
        quantity: String(asset.quantity ?? 1),
        purchase_price: asset.purchase_price ?? '',
        purchase_date: asset.purchase_date?.slice(0, 10) ?? '',
        serial_number: asset.serial_number ?? '',
        barcode: asset.barcode ?? '',
        notes: asset.notes ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    // Load reference data (categories/locations/statuses/employees/models)
    setRefError(null);
    Promise.all([
      getCategories().then(setCategories),
      getLocationsTree().then(setLocations),
      getStatuses().then(setStatuses),
      getEmployees().then(setEmployees),
      getModels().then(setModels),
    ]).catch((err) => setRefError(humanError(err, 'Could not load form options.')));
  }, [open, mode, asset]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const modelsForCategory = useMemo(
    () => models.filter((m) => !form.category_id || !m.category_id || m.category_id === form.category_id),
    [models, form.category_id],
  );

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters.';
    if (mode === 'create') {
      if (!form.category_id) e.category_id = 'Choose an asset type.';
      if (!form.location_id) e.location_id = 'Choose a location.';
      if (!form.status_id) e.status_id = 'Choose a status.';
    }
    const qty = Number(form.quantity);
    if (!form.quantity || Number.isNaN(qty) || qty <= 0) e.quantity = 'Quantity must be a number greater than zero.';
    if (form.purchase_price && (Number.isNaN(Number(form.purchase_price)) || Number(form.purchase_price) < 0)) {
      e.purchase_price = 'Price cannot be negative.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      if (mode === 'create') {
        const asset = await createAsset({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category_id: form.category_id!,
          location_id: form.location_id!,
          status_id: form.status_id,
          employee_id: form.employee_id || undefined,
          model_id: form.model_id || undefined,
          quantity: Number(form.quantity),
          purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined,
          purchase_date: form.purchase_date || undefined,
          serial_number: form.serial_number.trim() || undefined,
          barcode: form.barcode.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
        onSaved(asset, 'created');
      } else if (asset) {
        const updated = await updateAsset(asset.id, {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          category_id: form.category_id ?? undefined,
          location_id: form.location_id ?? undefined,
          model_id: form.model_id ?? undefined,
          quantity: Number(form.quantity),
          employee_id: form.employee_id ?? null,
          purchase_price: form.purchase_price ? Number(form.purchase_price) : undefined,
          notes: form.notes.trim() || undefined,
        });
        onSaved(updated, 'updated');
      }
      onClose();
    } catch (err) {
      setServerError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'create' ? 'New Asset' : `Edit ${asset?.name ?? 'asset'}`} size="lg">
      <form onSubmit={submit} className="space-y-4">
        {refError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{refError}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Asset name *" error={errors.name} className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus minLength={2} required placeholder="e.g. Laptop X4" />
          </Field>
          <Field label="Asset type *" error={errors.category_id}>
            <SearchableSelect
              options={categories}
              value={form.category_id}
              onChange={(v) => { set('category_id', v); set('model_id', null); }}
              placeholder="Choose type…"
            />
          </Field>
          <Field label="Model">
            <SearchableSelect
              options={modelsForCategory.map((m) => ({ value: m.id, label: m.name }))}
              value={form.model_id}
              onChange={(v) => set('model_id', v)}
              placeholder="Optional…"
            />
          </Field>
          <Field label="Location *" error={errors.location_id}>
            <SearchableSelect options={locations} value={form.location_id} onChange={(v) => set('location_id', v)} placeholder="Choose location…" />
          </Field>
          {mode === 'create' && (
            <Field label="Status *" error={errors.status_id}>
              <Select value={form.status_id} onChange={(e) => set('status_id', e.target.value)} required>
                <option value="">Choose status…</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Custodian (employee)">
            <SearchableSelect
              options={employees.map((p) => ({ value: p.id, label: p.department ? `${p.name} · ${p.department}` : p.name }))}
              value={form.employee_id}
              onChange={(v) => set('employee_id', v)}
              placeholder="Optional…"
            />
          </Field>
          <Field label="Quantity *" error={errors.quantity}>
            <Input type="number" min={1} step={1} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />
          </Field>
          <Field label="Purchase price" error={errors.purchase_price}>
            <Input type="number" min={0} step="0.01" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Purchase date">
            <Input type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} />
          </Field>
          <Field label="Serial number">
            <Input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Barcode">
            <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Optional" />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What is this asset?" />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Internal notes (optional)" />
          </Field>
        </div>
        {serverError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            {mode === 'create' ? 'Create asset' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
