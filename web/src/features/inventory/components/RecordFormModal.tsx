'use client';

/**
 * CountRecordModal — record the actual (counted) result for a snapshot row.
 * Maps to backend RecordResultDto / UpdateRecordDto exactly.
 * Result (matched/missing/…) is COMPUTED by the DB view — never guessed here;
 * we only show a live preview of what the database will compute (same rules).
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';
import { recordCount, updateRecord, InventoryRecordRow, InventoryLookups, InventoryResult, RecordCountInput } from '../api';
import {
  CONDITION_NAMES, composeNotes, conditionLabelKey, dominantCondition, parseConditionNotes, totalCondition, ConditionCount,
} from '../condition-breakdown';

export const RESULT_TONE: Record<InventoryResult, BadgeTone> = {
  matched: 'success',
  deficit: 'warning',
  surplus: 'warning',
  transferred: 'info',
  missing: 'danger',
  not_inventoried: 'neutral',
};

interface Props {
  open: boolean;
  cycleId: string;
  record: InventoryRecordRow;
  lookups: InventoryLookups;
  onClose: () => void;
  onSaved: (mode?: 'online' | 'offline') => void;
  onOfflineSaved?: (payload: RecordCountInput) => void;
}

export function CountRecordModal({ open, cycleId, record, lookups, onClose, onSaved, onOfflineSaved }: Props) {
  const { label, t } = useI18n();
  const isRecount = record.result !== 'not_inventoried';
  const [qty, setQty] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  // Breakdown of the counted quantity by condition (kept inside the notes text, see condition-breakdown.ts).
  const [condition, setCondition] = useState<Record<string, string>>({});
  const [extraCounts, setExtraCounts] = useState<ConditionCount[]>([]); // custom status names written by other clients: kept untouched
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setQty(isRecount && record.actual_quantity != null ? String(record.actual_quantity) : '');
    setLocationId(record.actual_location_id ?? record.expected_location_id);
    setStatusId(record.actual_status_id ?? record.expected_status_id);
    setEmployeeId(record.actual_employee_id ?? record.expected_employee_id);
    const parsed = parseConditionNotes(record.notes);
    const known = new Set<string>(CONDITION_NAMES.map((name) => name.toLowerCase()));
    setNotes(parsed.restNotes);
    setCondition(Object.fromEntries(CONDITION_NAMES.map((name) => [name, String(parsed.counts.find((count) => count.name.toLowerCase() === name.toLowerCase())?.quantity ?? '')])));
    setExtraCounts(parsed.counts.filter((count) => !known.has(count.name.toLowerCase())));
  }, [open, record, isRecount]);

  const conditionCounts: ConditionCount[] = useMemo(() => [
    ...CONDITION_NAMES.map((name) => ({ name: name as string, quantity: Number(condition[name] || 0) })).filter((count) => count.quantity > 0),
    ...extraCounts,
  ], [condition, extraCounts]);

  /** Live preview mirrors v_inventory_result exactly (informational only). */
  const preview: InventoryResult | null = useMemo(() => {
    if (qty === '') return null;
    const q = Number(qty);
    if (Number.isNaN(q) || q < 0) return null;
    if (q === 0) return 'missing';
    const expected = record.expected_quantity ?? 0;
    if (q < expected) return 'deficit';
    if (q > expected) return 'surplus';
    if ((locationId ?? null) !== (record.expected_location_id ?? null)) return 'transferred';
    return 'matched';
  }, [qty, locationId, record]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const q = Number(qty);
    if (qty === '' || Number.isNaN(q) || q < 0) { setError(t('inventoryRecord.quantityInvalid')); return; }
    const invalidPart = CONDITION_NAMES.some((name) => { const n = Number(condition[name] || 0); return !Number.isInteger(n) || n < 0; });
    if (invalidPart) { setError(t('inventoryRecord.quantityInvalid')); return; }
    const breakdownTotal = totalCondition(conditionCounts);
    if (breakdownTotal > 0 && breakdownTotal !== q) {
      setError(t('inventoryRecord.breakdownMismatch').replace('{sum}', String(breakdownTotal)).replace('{qty}', String(q)));
      return;
    }
    // With a breakdown, the record's main status follows the largest part (same rule as the mobile app).
    const dominant = breakdownTotal > 0 ? dominantCondition(conditionCounts) : null;
    const dominantStatus = dominant ? [...lookups.statuses.values()].find((s) => s.name.trim().toLowerCase() === dominant.toLowerCase()) : undefined;
    setSaving(true);
    try {
      const payload: RecordCountInput = {
        actual_quantity: q,
        actual_location_id: locationId,
        actual_status_id: dominantStatus?.id ?? statusId,
        actual_employee_id: employeeId,
        // Sent as an explicit empty string when cleared so the old text is really removed (undefined would keep it).
        notes: composeNotes(notes, breakdownTotal > 0 ? conditionCounts : []) ?? '',
      };
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      if (offline && onOfflineSaved) {
        onOfflineSaved(payload);
        onSaved('offline');
        onClose();
        return;
      }
      if (isRecount) await updateRecord(record.id, payload);
      else await recordCount(cycleId, record.asset_id, payload);
      onSaved('online');
      onClose();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  const locationOptions = [...lookups.locations.entries()].map(([value, lbl]) => ({ value, label: lbl }));
  const statusOptions = [...lookups.statuses.values()].map((s) => ({ value: s.id, label: s.name }));
  const employeeOptions = [...lookups.employees.values()].map((p) => ({ value: p.id, label: p.department ? `${p.name} · ${p.department}` : p.name }));

  return (
    <Modal open={open} onClose={onClose} title={`${isRecount ? t('inventoryRecord.recount') : t('inventoryRecord.count')} — ${record._assetName ?? t('inventoryRecord.asset')}`} size="md">
      {/* Expected snapshot */}
      <div className="mb-4 rounded-lg bg-surface-muted px-3 py-2 text-xs text-ink-muted">
        <span className="font-medium text-ink">{t('inventoryRecord.expected')}</span> {t('inventoryRecord.quantity')} {record.expected_quantity ?? '—'}
        {record._assetCode ? ` · ${record._assetCode}` : ''}
        {` · ${record._expectedLocation ?? '—'}`}
        {record._expectedStatus ? ` · ${record._expectedStatus}` : ''}
        {record._expectedEmployee ? ` · ${t('inventoryRecord.custodian')} ${record._expectedEmployee}` : ''}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('inventoryRecord.countedQuantity')} hint={t('inventoryRecord.quantityHint').replace('{count}', String(record.expected_quantity ?? '—'))}>
            <Input type="number" min={0} step={1} value={qty} onChange={(e) => setQty(e.target.value)} autoFocus required />
          </Field>
          <Field label={t('inventoryRecord.actualLocation')}>
            <SearchableSelect options={locationOptions} value={locationId} onChange={setLocationId} placeholder={t('inventoryRecord.foundAt')} clearable={false} />
          </Field>
          <Field label={t('inventoryRecord.actualStatus')}>
            <SearchableSelect options={statusOptions} value={statusId} onChange={setStatusId} placeholder={t('inventoryRecord.condition')} />
          </Field>
          <Field label={t('inventoryRecord.actualCustodian')}>
            <SearchableSelect options={employeeOptions} value={employeeId} onChange={setEmployeeId} placeholder={t('inventoryRecord.holder')} />
          </Field>
        </div>
        <Field label={t('inventoryRecord.breakdown')} hint={t('inventoryRecord.breakdownHint')}>
          <div className="grid grid-cols-3 gap-2">
            {CONDITION_NAMES.map((name) => (
              <label key={name} className="space-y-1 text-xs text-ink-muted">
                <span>{t(conditionLabelKey(name) ?? name, name)}</span>
                <Input type="number" min={0} step={1} value={condition[name] ?? ''} onChange={(e) => setCondition((prev) => ({ ...prev, [name]: e.target.value }))} />
              </label>
            ))}
          </div>
        </Field>
        <Field label={t('inventoryRecord.notes')}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('inventoryRecord.notesPlaceholder')} />
        </Field>
        {preview && (
          <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
            <span className="text-ink-muted">{t('inventoryRecord.resultPreview')}</span>
            <Badge tone={RESULT_TONE[preview]}>{label(preview)}</Badge>
            {isRecount && <span className="text-xs text-ink-faint">{t('inventoryRecord.recountNotice')}</span>}
          </div>
        )}
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('inventoryRecord.cancel')}</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>{t('inventoryRecord.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
