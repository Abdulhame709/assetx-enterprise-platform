'use client';

import { useMemo, useState } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/Checkbox';
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

const MIN_WIDTH = 3;
const MAX_WIDTH = 60;

type WidthText = Record<string, Record<string, string>>;

/** What the boxes show for the saved widths ("" = automatic). */
function widthText(designer: ReportDesigner): WidthText {
  const out: WidthText = {};
  for (const resource of Object.keys(designer.catalog)) {
    out[resource] = {};
    for (const key of designer.catalog[resource].columns) {
      const width = designer.widths[resource]?.[key];
      out[resource][key] = width === undefined ? '' : String(width);
    }
  }
  return out;
}

const widthValid = (text: string) => text === '' || (/^[0-9]{1,2}$/.test(text) && Number(text) >= MIN_WIDTH && Number(text) <= MAX_WIDTH);

/** Only the typed widths of one report, as numbers. */
function widthMap(texts: Record<string, string> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, text] of Object.entries(texts ?? {})) if (text !== '') out[key] = Number(text);
  return out;
}

function sameMap(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
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
  // widths typed per report, edited locally until saved
  const [widths, setWidths] = useState<WidthText>(() => widthText(initial));
  const [busy, setBusy] = useState(false);

  const label = (key: string) => initial.labels[key]?.[locale === 'ar' ? 'ar' : 'en'] ?? key;
  const title = (key: string) => initial.titles[key]?.[locale === 'ar' ? 'ar' : 'en'] ?? key;

  const rowsNumber = Number(rows);
  const rowsValid = rows.trim() !== '' && Number.isInteger(rowsNumber) && (rowsNumber === 0 || (rowsNumber >= MIN_ROWS && rowsNumber <= MAX_ROWS));

  const entry = initial.catalog[resource];
  const current = widths[resource] ?? {};
  const allValid = Object.values(widths).every((report) => Object.values(report).every(widthValid));
  const total = Object.values(widthMap(current)).reduce((sum, width) => sum + width, 0);
  const overflow = Object.values(widths).some((report) => Object.values(widthMap(report)).reduce((sum, width) => sum + width, 0) > 100);

  const setWidth = (key: string, text: string) => setWidths((all) => ({ ...all, [resource]: { ...all[resource], [key]: text.replace(/[^0-9]/g, '').slice(0, 2) } }));
  const resetWidths = () => setWidths((all) => ({ ...all, [resource]: Object.fromEntries(Object.keys(all[resource] ?? {}).map((key) => [key, ''])) }));

  // Only the reports that changed are sent; an empty map tells the server to go back to automatic.
  const changedWidths = (): Record<string, Record<string, number>> => {
    const out: Record<string, Record<string, number>> = {};
    for (const r of resources) {
      const now = widthMap(widths[r]);
      if (!sameMap(now, saved.widths[r] ?? {})) out[r] = now;
    }
    return out;
  };

  const dirty = rowsValid && allValid && !overflow && (
    rowsNumber !== saved.rows_per_page || totals !== saved.show_totals || numbers !== saved.row_numbers
    || Object.keys(changedWidths()).length > 0
  );

  async function save() {
    setBusy(true);
    try {
      const changes = changedWidths();
      const next = await updateReportDesigner({
        rows_per_page: rowsNumber,
        show_totals: totals,
        row_numbers: numbers,
        ...(Object.keys(changes).length > 0 ? { widths: changes } : {}),
      });
      setSaved(next);
      setRows(String(next.rows_per_page));
      setTotals(next.show_totals);
      setNumbers(next.row_numbers);
      setWidths(widthText(next));
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
        <Checkbox checked={totals} disabled={!canEdit || busy} onChange={(e) => setTotals(e.target.checked)} label={t('rd.showTotals')} description={t('rd.showTotalsHint')} />
        <Checkbox checked={numbers} disabled={!canEdit || busy} onChange={(e) => setNumbers(e.target.checked)} label={t('rd.rowNumbers')} description={t('rd.rowNumbersHint')} />
      </div>

      <div className="space-y-3 border-t border-line pt-4">
        <Field label={t('rd.report')}>
          <Select value={resource} disabled={busy} onChange={(e) => setResource(e.target.value)}>
            {resources.map((r) => <option key={r} value={r}>{title(r)}</option>)}
          </Select>
        </Field>

        <div>
          <p className="ax-label">{t('rd.widthsTitle')}</p>
          <p className="text-xs text-ink-faint">{t('rd.widthsHint')}</p>
        </div>

        <ul className="divide-y divide-line rounded-lg border border-line" aria-label={t('rd.widthsTitle')}>
          {(entry?.columns ?? []).map((key) => {
            const text = current[key] ?? '';
            const ok = widthValid(text);
            return (
              <li key={key} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                <span className="flex-1 text-ink">{label(key)}</span>
                <Input
                  inputMode="numeric"
                  className="w-20 text-center"
                  value={text}
                  placeholder={t('rd.widthAuto')}
                  disabled={!canEdit || busy}
                  aria-label={label(key)}
                  aria-invalid={!ok}
                  onChange={(e) => setWidth(key, e.target.value)}
                />
                <span className="w-4 text-ink-muted">{t('rd.widthPercent')}</span>
              </li>
            );
          })}
        </ul>
        {!Object.values(current).every(widthValid) && <p className="text-xs text-danger">{t('rd.widthInvalid')}</p>}
        {total > 0 && <p className={total > 100 ? 'text-xs text-danger' : 'text-xs text-ink-muted'}>{t('rd.widthTotal').replace('{total}', String(total))}</p>}
        {overflow && <p className="text-xs text-danger">{t('rd.widthOver')}</p>}

        {canEdit && total > 0 && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={resetWidths}>
            {t('rd.widthReset')}
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
