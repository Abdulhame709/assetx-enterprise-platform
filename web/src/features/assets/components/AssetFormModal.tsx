'use client';

/**
 * AssetFormModal — create/edit an asset with REAL validation + REAL submission.
 * Rules mirror AssetService.validateCreate: name ≥ 2, category/location/status
 * required, quantity > 0, price ≥ 0, depreciation 0–100.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { humanError } from '@/lib/api/errors';
import { getStatuses, getEmployees, getModels, ReferenceEmployee, ReferenceModel, ReferenceStatus } from '@/features/reference/api';
import { getCategories } from '../api';
import { getLocationsTree } from './reference-selects';
import { createAsset, updateAsset, AssetDetail } from '../api';
import { useI18n } from '@/lib/i18n';

interface Props {
  open: boolean;
  mode: 'create' | 'edit' | 'copy';
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

function formFromAsset(asset: AssetDetail): FormState {
  return {
    name: asset.name ?? '', description: asset.description ?? '',
    category_id: asset.category_id ?? null, location_id: asset.location_id ?? null,
    status_id: asset.status_id ?? '', employee_id: asset.employee_id ?? null,
    model_id: asset.model_id ?? null, quantity: String(asset.quantity ?? 1),
    purchase_price: asset.purchase_price ?? '', purchase_date: asset.purchase_date?.slice(0, 10) ?? '',
    serial_number: asset.serial_number ?? '', barcode: asset.barcode ?? '', notes: asset.notes ?? '',
  };
}

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
  const [createdAsset, setCreatedAsset] = useState<AssetDetail | null>(null);
  const { t, locale } = useI18n();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setServerError(null);
    setCreatedAsset(null);
    if (asset && (mode === 'edit' || mode === 'copy')) {
      const next = formFromAsset(asset);
      if (mode === 'copy') {
        next.quantity = '1';
        next.serial_number = '';
        next.barcode = '';
      }
      setForm(next);
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
    ]).catch((err) => setRefError(humanError(err, t('assetForm.formLoadFailed'))));
  }, [open, mode, asset, t]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const modelsForCategory = useMemo(
    () => models.filter((m) => !form.category_id || !m.category_id || m.category_id === form.category_id),
    [models, form.category_id],
  );

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (form.name.trim().length < 2) e.name = t('assetForm.nameTooShort');
    if (mode !== 'edit') {
      if (!form.category_id) e.category_id = t('assetForm.chooseAssetType');
      if (!form.location_id) e.location_id = t('assetForm.chooseAssetLocation');
      if (!form.status_id) e.status_id = t('assetForm.chooseAssetStatus');
    }
    const qty = Number(form.quantity);
    if (!form.quantity || Number.isNaN(qty) || qty <= 0) e.quantity = t('assetForm.quantityInvalid');
    if (form.purchase_price && (Number.isNaN(Number(form.purchase_price)) || Number(form.purchase_price) < 0)) {
      e.purchase_price = t('assetForm.priceNegative');
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
      if (mode !== 'edit') {
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
        setCreatedAsset(asset);
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
      if (mode === 'edit') onClose();
    } catch (err) {
      setServerError(humanError(err, t('common.genericError'), locale));
    } finally {
      setSaving(false);
    }
  };

  const startAnother = () => {
    setCreatedAsset(null);
    setForm(EMPTY);
    setErrors({});
    setServerError(null);
  };

  return (
    <Modal open={open} onClose={onClose} title={createdAsset ? t('assetForm.createdTitle') : mode === 'copy' ? `${t('assetForm.copyTitle')} ${asset?.name ?? ''}` : mode === 'create' ? t('assetForm.newTitle') : `${t('assetForm.editTitle')} ${asset?.name ?? ''}`} size="lg">
      {createdAsset ? (
        <div className="space-y-5">
          <div className="rounded-xl border border-success/25 bg-success/10 p-4">
            <p className="text-base font-semibold text-success">{createdAsset.name}</p>
            <p className="mt-1 text-sm text-ink-muted">{t('assetForm.createdDescription')}</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-surface-subtle p-3">
              <dt className="text-xs font-medium text-ink-muted">{t('assetForm.fullCode')}</dt>
              <dd className="mt-1 break-all font-mono text-sm font-semibold text-ink">{createdAsset.full_asset_code}</dd>
            </div>
            <div className="rounded-lg border border-line bg-surface-subtle p-3">
              <dt className="text-xs font-medium text-ink-muted">{t('assetForm.baseCode')}</dt>
              <dd className="mt-1 break-all font-mono text-sm font-semibold text-ink">{createdAsset.base_asset_code}</dd>
            </div>
          </dl>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={startAnother}>{t('assetForm.createAnother')}</Button>
            <Link href={`/assets/${createdAsset.id}`} onClick={onClose} className="inline-flex items-center justify-center rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-strong">{t('assetForm.openAsset')}</Link>
            <Button type="button" variant="primary" size="sm" onClick={onClose}>{t('assetForm.cancel')}</Button>
          </div>
        </div>
      ) : (
      <form onSubmit={submit} className="space-y-4">
        <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs text-ink-muted">{t('assetForm.requiredHint')}</p>
        {refError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{refError}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('assetForm.assetName')} error={errors.name} className="sm:col-span-2">
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus minLength={2} required placeholder={t('assetForm.exampleName')} />
          </Field>
          <Field label={t('assetForm.assetType')} error={errors.category_id}>
            <SearchableSelect
              options={categories}
              value={form.category_id}
              onChange={(v) => { set('category_id', v); set('model_id', null); }}
              placeholder={t('assetForm.chooseType')}
            />
          </Field>
          <Field label={t('assetForm.model')}>
            <SearchableSelect
              options={modelsForCategory.map((m) => ({ value: m.id, label: m.name }))}
              value={form.model_id}
              onChange={(v) => set('model_id', v)}
              placeholder={t('assetForm.optional')}
            />
          </Field>
          <Field label={t('assetForm.location')} error={errors.location_id}>
            <SearchableSelect options={locations} value={form.location_id} onChange={(v) => set('location_id', v)} placeholder={t('assetForm.chooseLocation')} />
          </Field>
          {mode !== 'edit' && (
            <Field label={t('assetForm.status')} error={errors.status_id}>
              <Select value={form.status_id} onChange={(e) => set('status_id', e.target.value)} required>
                <option value="">{t('assetForm.chooseStatus')}</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <Field label={t('assetForm.custodian')}>
            <SearchableSelect
              options={employees.map((p) => ({ value: p.id, label: p.department ? `${p.name} · ${p.department}` : p.name }))}
              value={form.employee_id}
              onChange={(v) => set('employee_id', v)}
              placeholder={t('assetForm.optional')}
            />
          </Field>
          <Field label={t('assetForm.quantity')} error={errors.quantity}>
            <Input type="number" min={1} step={1} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} required />
          </Field>
          <Field label={t('assetForm.purchasePrice')} error={errors.purchase_price}>
            <Input type="number" min={0} step="0.01" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label={t('assetForm.purchaseDate')}>
            <Input type="date" value={form.purchase_date} onChange={(e) => set('purchase_date', e.target.value)} />
          </Field>
          <Field label={t('assetForm.serialNumber')}>
            <Input value={form.serial_number} onChange={(e) => set('serial_number', e.target.value)} placeholder={t('assetForm.optional')} />
          </Field>
          <Field label={t('assetForm.barcode')}>
            <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder={t('assetForm.optional')} />
          </Field>
          <Field label={t('assetForm.description')} className="sm:col-span-2">
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('assetForm.whatIsAsset')} />
          </Field>
          <Field label={t('assetForm.notes')} className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t('assetForm.internalNotes')} />
          </Field>
        </div>
        {serverError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>}
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-1 pt-3">
          {mode === 'edit' && asset && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setForm(formFromAsset(asset))}>{t('assetForm.revert')}</Button>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('assetForm.cancel')}</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            {mode === 'edit' ? t('assetForm.save') : t('assetForm.saveNew')}
          </Button>
        </div>
      </form>
      )}
    </Modal>
  );
}
