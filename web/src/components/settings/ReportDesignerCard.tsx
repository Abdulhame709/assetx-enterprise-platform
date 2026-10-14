'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/Toast';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { useI18n } from '@/lib/i18n';
import { useCan } from '@/lib/auth/session-context';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { humanError } from '@/lib/api/errors';
import { useAsync } from '@/lib/use-async';
import { ReportDesigner, getReportDesigner, updateReportDesigner } from '@/features/settings/api';

const MIN_ROWS = 5;
const MAX_ROWS = 100;

/** Report designer — columns, rows per page, totals and numbering for every report. */
export function ReportDesignerCard() {
  const { t } = useI18n();
  const state = useAsync<ReportDesigner>(() => getReportDesigner(), []);
  return (
    <Card>
      <CardHeader title={t('rd.title')} subtitle={t('rd.desc')} />
      <CardBody>
        <AsyncBoundary state={state}>{(data) => <DesignerForm initial={data} />}</AsyncBoundary>
      </CardBody>
    </Card>
  );
}

/** The columns a report prints now: the saved choice, else its defaults. */
function currentColumns(designer: ReportDesigner, resource: string): string[] {
  const saved = designer.columns[resource];
  return saved && saved.length > 0 ? saved : designer.catalog[resource]?.defaults ?? [];
}

function DesignerForm({ initial }: { initial: ReportDesigner }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const canEdit = useCan()(PERMISSIONS.SETTINGS_UPDATE);
  const [saved, setSaved] = useState<ReportDesigner>(initial);
  const resources = useMemo(() => Object.keys(initial.catalog), [initial.catalog]);
  const [resource, setResource] = useState(resources[0] ?? 'assets');
  const [rows, setRows] = useState(String(initial.rows_per_page));
  const [totals, setTotals] = useState(initial.show_totals);
  const [numbers, setNumbers] = useState(initial.row_numbers);
  // chosen columns per report, edited locally until saved
  const [columns, setColumns] = useState<Record<string, string[]>>(() => {
    const out: Record<string, string[]> = {};
    for (const r of Object.keys(initial.catalog)) out[r] = currentColumns(initial, r);
    return out;
  });
  const [busy, setBusy] = useState(false);

  const label = (key: string) => initial.labels[key]?.[locale === 'ar' ? 'ar' : 'en'] ?? key;
  const title = (key: string) => initial.titles[key]?.[locale === 'ar' ? 'ar' : 'en'] ?? key;

  const rowsNumber = Number(rows);
  const rowsValid = rows.trim() !== '' && Number.isInteger(rowsNumber) && (rowsNumber === 0 || (rowsNumber >= MIN_ROWS && rowsNumber <= MAX_ROWS));

  const entry = initial.catalog[resource];
  const chosen = columns[resource] ?? [];
  const isDefault = !!entry && chosen.length === entry.defaults.length && chosen.every((key, i) => key === entry.defaults[i]);
  const unchosen = (entry?.columns ?? []).filter((key) => !chosen.includes(key));

  const setChosen = (next: string[]) => setColumns((c) => ({ ...c, [resource]: next }));
  const toggle = (key: string, on: boolean) => {
    if (on) setChosen([...chosen, key]);
    else if (chosen.length > 1) setChosen(chosen.filter((k) => k !== key));
  };
  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= chosen.length) return;
    const next = [...chosen];
    [next[index], next[target]] = [next[target], next[index]];
    setChosen(next);
  };

  // Only what differs from what is saved is sent; defaults are sent as [] so the server resets them.
  const changedColumns = (): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    for (const r of resources) {
      const now = columns[r] ?? [];
      const before = currentColumns(saved, r);
      if (now.length === before.length && now.every((key, i) => key === before[i])) continue;
      const defaults = saved.catalog[r]?.defaults ?? [];
      const sameAsDefaults = now.length === defaults.length && now.every((key, i) => key === defaults[i]);
      out[r] = sameAsDefaults ? [] : now;
    }
    return out;
  };

  const dirty = rowsValid && (
    rowsNumber !== saved.rows_per_page || totals !== saved.show_totals || numbers !== saved.row_numbers
    || Object.keys(changedColumns()).length > 0
  );

  async function save() {
    setBusy(true);
    try {
      const changes = changedColumns();
      const next = await updateReportDesigner({
        rows_per_page: rowsNumber,
        show_totals: totals,
        row_numbers: numbers,
        ...(Object.keys(changes).length > 0 ? { columns: changes } : {}),
      });
      setSaved(next);
      setRows(String(next.rows_per_page));
      setTotals(next.show_totals);
      setNumbers(next.row_numbers);
      const fresh: Record<string, string[]> = {};
      for (const r of Object.keys(next.catalog)) fresh[r] = currentColumns(next, r);
      setColumns(fresh);
      toast.success(t('rd.saved'), t('rd.savedDesc'));
    } catch (err) {
      toast.error(t('common.error'), humanError(err, undefined, locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!canEdit && <p className="text-sm text-ink-muted">{t('rd.readOnly')}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        <Field label={t('rd.rowsPerPage')} hint={t('rd.rowsPerPageHint')} error={rowsValid ? undefined : t('rd.rowsInvalid')}>
          <Input
            inputMode="numeric"
            value={rows}
            disabled={!canEdit || busy}
            onChange={(e) => setRows(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
          />
        </Field>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={totals} disabled={!canEdit || busy} onChange={(e) => setTotals(e.target.checked)} />
          <span>
            {t('rd.showTotals')}
            <span className="block text-xs text-ink-faint">{t('rd.showTotalsHint')}</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={numbers} disabled={!canEdit || busy} onChange={(e) => setNumbers(e.target.checked)} />
          <span>
            {t('rd.rowNumbers')}
            <span className="block text-xs text-ink-faint">{t('rd.rowNumbersHint')}</span>
          </span>
        </label>
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <Field label={t('rd.report')}>
          <Select value={resource} disabled={busy} onChange={(e) => setResource(e.target.value)}>
            {resources.map((r) => <option key={r} value={r}>{title(r)}</option>)}
          </Select>
        </Field>

        <div>
          <p className="ax-label">{t('rd.columns')}</p>
          <p className="text-xs text-ink-faint">{t('rd.columnsHint')}</p>
          <p className="mt-1 text-xs text-ink-muted">{isDefault ? t('rd.usingDefaults') : t('rd.customised')}</p>
        </div>

        <ul className="divide-y divide-line rounded-lg border border-line" aria-label={t('rd.columns')}>
          {chosen.map((key, index) => (
            <li key={key} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <input
                type="checkbox"
                checked
                disabled={!canEdit || busy || chosen.length === 1}
                aria-label={label(key)}
                onChange={(e) => toggle(key, e.target.checked)}
              />
              <span className="flex-1 text-ink">{label(key)}</span>
              {canEdit && (
                <span className="flex gap-1">
                  <Button variant="ghost" size="sm" aria-label={t('rd.moveUp')} disabled={busy || index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={t('rd.moveDown')} disabled={busy || index === chosen.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </span>
              )}
            </li>
          ))}
          {unchosen.map((key) => (
            <li key={key} className="flex items-center gap-2 bg-surface-muted/40 px-3 py-1.5 text-sm">
              <input type="checkbox" checked={false} disabled={!canEdit || busy} aria-label={label(key)} onChange={(e) => toggle(key, e.target.checked)} />
              <span className="flex-1 text-ink-muted">{label(key)}</span>
            </li>
          ))}
        </ul>
        {chosen.length === 1 && <p className="text-xs text-ink-faint">{t('rd.atLeastOne')}</p>}

        {canEdit && !isDefault && entry && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setChosen([...entry.defaults])}>
            {t('rd.useDefaults')}
          </Button>
        )}
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button loading={busy} disabled={!dirty} onClick={() => void save()}>
            {t('rd.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
