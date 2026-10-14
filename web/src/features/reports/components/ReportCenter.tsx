'use client';

import { useEffect, useState } from 'react';
import { Download, Eye, Printer, RotateCcw } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { SearchableSelect, SelectOption } from '@/components/ui/SearchableSelect';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';
import { useCan } from '@/lib/auth/session-context';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { humanError } from '@/lib/api/errors';
import { getCategories, getLocationsTree } from '@/features/assets/components/reference-selects';
import { getEmployees, getStatuses } from '@/features/reference/api';
import {
  AssetSortKey, ReportCenterResource, ReportFilters, ReportFormat, ReportPreview,
  downloadReportExport, generateReportAiSummary, getReportPreview, printReportExport,
} from '../api';

type FilterKey = 'location' | 'scope' | 'category' | 'status' | 'employee' | 'search' | 'sort' | 'blank';

/** Which filters each report understands (mirrors the server's allow-list). */
const REPORTS: Array<{ id: ReportCenterResource; filters: FilterKey[] }> = [
  { id: 'assets', filters: ['location', 'category', 'status', 'employee', 'search', 'sort'] },
  { id: 'asset-locations', filters: ['location', 'scope'] },
  { id: 'asset-types', filters: ['location', 'status'] },
  { id: 'duplicates', filters: ['category'] },
  { id: 'inventory-form', filters: ['location', 'category', 'status', 'employee', 'search', 'sort', 'blank'] },
];

const SORT_KEYS: AssetSortKey[] = ['location', 'category', 'name', 'status', 'employee', 'code', 'price'];
const NO_EMPLOYEE = 'none';
const PRINT_LIMIT = 10000;
const MAX_BLANK_ROWS = 500;

interface FormState {
  location_id: string;
  location_scope: '' | 'main' | 'sub';
  category_id: string;
  status_id: string;
  employee_id: string;
  q: string;
  sort_by: '' | AssetSortKey;
  sort_dir: 'asc' | 'desc';
  blank_rows: string;
}

const EMPTY: FormState = {
  location_id: '', location_scope: '', category_id: '', status_id: '', employee_id: '',
  q: '', sort_by: '', sort_dir: 'asc', blank_rows: '0',
};

/** Report center — pick a report, filter and sort it, then view, print or download it. */
export function ReportCenter() {
  const { t, locale } = useI18n();
  const can = useCan();
  const toast = useToast();
  const allowed = can(PERMISSIONS.EXPORT_ASSETS);
  const canUseAi = can(PERMISSIONS.AI_USE);

  const [report, setReport] = useState<ReportCenterResource>('assets');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [withAi, setWithAi] = useState(false);
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [busy, setBusy] = useState<'view' | 'print' | 'download' | null>(null);

  const [locations, setLocations] = useState<SelectOption[]>([]);
  const [categories, setCategories] = useState<SelectOption[]>([]);
  const [statuses, setStatuses] = useState<SelectOption[]>([]);
  const [employees, setEmployees] = useState<SelectOption[]>([]);

  useEffect(() => {
    if (!allowed) return;
    getLocationsTree().then(setLocations).catch(() => undefined);
    getCategories().then(setCategories).catch(() => undefined);
    getStatuses().then((list) => setStatuses(list.filter((s) => s.is_active).map((s) => ({ value: s.id, label: s.name })))).catch(() => undefined);
    getEmployees().then((list) => setEmployees(list.map((e) => ({ value: e.id, label: e.name })))).catch(() => undefined);
  }, [allowed]);

  if (!allowed) {
    return (
      <Card>
        <CardHeader title={t('rc.title')} />
        <CardBody><p className="text-sm text-ink-muted">{t('rc.noAccess')}</p></CardBody>
      </Card>
    );
  }

  const current = REPORTS.find((r) => r.id === report) ?? REPORTS[0];
  const has = (key: FilterKey) => current.filters.includes(key);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const blankRows = Math.min(Math.max(parseInt(form.blank_rows, 10) || 0, 0), MAX_BLANK_ROWS);

  // Only the filters this report understands are sent.
  const filters = (): ReportFilters => {
    const out: ReportFilters = {};
    if (has('location') && form.location_id) out.location_id = form.location_id;
    if (has('scope') && form.location_scope) out.location_scope = form.location_scope;
    if (has('category') && form.category_id) out.category_id = form.category_id;
    if (has('status') && form.status_id) out.status_id = form.status_id;
    if (has('employee') && form.employee_id) out.employee_id = form.employee_id;
    if (has('search') && form.q.trim()) out.q = form.q.trim();
    if (has('sort') && form.sort_by) { out.sort_by = form.sort_by; out.sort_dir = form.sort_dir; }
    if (has('blank') && blankRows > 0) out.blank_rows = blankRows;
    return out;
  };

  const chooseReport = (next: ReportCenterResource) => {
    setReport(next);
    setPreview(null);
    if (next !== 'assets') setWithAi(false);
  };

  /** The AI summary describes all assets, so it is only offered for the assets report. */
  const aiSummaryText = async (): Promise<string | undefined> => {
    if (!withAi || report !== 'assets' || !canUseAi) return undefined;
    const result = await generateReportAiSummary('assets');
    return result.summary.slice(0, 2000);
  };

  async function run(kind: 'view' | 'print' | 'download') {
    setBusy(kind);
    try {
      if (kind === 'view') {
        setPreview(await getReportPreview(report, filters()));
      } else if (kind === 'print') {
        toast.info(t('rc.printing'));
        await printReportExport(report, PRINT_LIMIT, { filters: filters(), summary: await aiSummaryText() });
      } else {
        await downloadReportExport({
          resource: report, format, limit: PRINT_LIMIT, filters: filters(),
          summary: format === 'pdf' ? await aiSummaryText() : undefined,
        });
        toast.success(t('rc.downloadReady'));
      }
    } catch (err) {
      const title = kind === 'view' ? t('rc.loadFailed') : kind === 'print' ? t('rc.printFailed') : t('rc.downloadFailed');
      toast.error(title, humanError(err, undefined, locale));
    } finally {
      setBusy(null);
    }
  }

  const reset = () => { setForm(EMPTY); setPreview(null); };

  return (
    <Card>
      <CardHeader title={t('rc.title')} subtitle={t('rc.desc')} />
      <CardBody>
        <div className="space-y-5">
          <Field label={t('rc.report')} hint={t('rc.type.' + report + 'Desc')}>
            <Select value={report} disabled={busy !== null} onChange={(e) => chooseReport(e.target.value as ReportCenterResource)}>
              {REPORTS.map((r) => <option key={r.id} value={r.id}>{t('rc.type.' + r.id)}</option>)}
            </Select>
          </Field>

          <div>
            <p className="ax-label mb-2">{t('rc.filters')}</p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {has('location') && (
                <Field label={t('rc.f.location')} hint={t('rc.f.locationHint')}>
                  <SearchableSelect options={locations} value={form.location_id || null} placeholder={t('rc.all')} onChange={(v) => set('location_id', v ?? '')} />
                </Field>
              )}
              {has('scope') && (
                <Field label={t('rc.f.scope')}>
                  <Select value={form.location_scope} onChange={(e) => set('location_scope', e.target.value as FormState['location_scope'])}>
                    <option value="">{t('rc.scope.all')}</option>
                    <option value="main">{t('rc.scope.main')}</option>
                    <option value="sub">{t('rc.scope.sub')}</option>
                  </Select>
                </Field>
              )}
              {has('category') && (
                <Field label={t('rc.f.category')}>
                  <SearchableSelect options={categories} value={form.category_id || null} placeholder={t('rc.all')} onChange={(v) => set('category_id', v ?? '')} />
                </Field>
              )}
              {has('status') && (
                <Field label={t('rc.f.status')}>
                  <SearchableSelect options={statuses} value={form.status_id || null} placeholder={t('rc.all')} onChange={(v) => set('status_id', v ?? '')} />
                </Field>
              )}
              {has('employee') && (
                <Field label={t('rc.f.employee')}>
                  <SearchableSelect
                    options={[{ value: NO_EMPLOYEE, label: t('rc.employee.none') }, ...employees]}
                    value={form.employee_id || null}
                    placeholder={t('rc.all')}
                    onChange={(v) => set('employee_id', v ?? '')}
                  />
                </Field>
              )}
              {has('search') && (
                <Field label={t('rc.f.search')}>
                  <Input value={form.q} maxLength={100} onChange={(e) => set('q', e.target.value)} />
                </Field>
              )}
              {has('sort') && (
                <>
                  <Field label={t('rc.f.sortBy')}>
                    <Select value={form.sort_by} onChange={(e) => set('sort_by', e.target.value as FormState['sort_by'])}>
                      <option value="">{t('rc.sort.none')}</option>
                      {SORT_KEYS.map((key) => <option key={key} value={key}>{t('rc.sort.' + key)}</option>)}
                    </Select>
                  </Field>
                  <Field label={t('rc.f.sortDir')}>
                    <Select value={form.sort_dir} disabled={!form.sort_by} onChange={(e) => set('sort_dir', e.target.value as 'asc' | 'desc')}>
                      <option value="asc">{t('rc.dir.asc')}</option>
                      <option value="desc">{t('rc.dir.desc')}</option>
                    </Select>
                  </Field>
                </>
              )}
              {has('blank') && (
                <Field label={t('rc.f.blankRows')} hint={t('rc.f.blankRowsHint')}>
                  <Input
                    inputMode="numeric"
                    value={form.blank_rows}
                    onChange={(e) => set('blank_rows', e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                  />
                </Field>
              )}
            </div>
          </div>

          {report === 'assets' && canUseAi && (
            <label className="flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" className="mt-1" checked={withAi} onChange={(e) => setWithAi(e.target.checked)} />
              <span>
                {t('rc.addAi')}
                <span className="block text-xs text-ink-faint">{t('rc.addAiHint')}</span>
              </span>
            </label>
          )}

          <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
            <Button variant="secondary" loading={busy === 'view'} disabled={busy !== null} onClick={() => void run('view')}>
              <Eye className="h-4 w-4" /> {t('rc.view')}
            </Button>
            <Button loading={busy === 'print'} disabled={busy !== null} onClick={() => void run('print')}>
              <Printer className="h-4 w-4" /> {t('rc.print')}
            </Button>
            <div className="flex items-end gap-2">
              <Field label={t('rc.format')}>
                <Select value={format} disabled={busy !== null} onChange={(e) => setFormat(e.target.value as ReportFormat)}>
                  <option value="pdf">PDF</option>
                  <option value="xlsx">Excel</option>
                  <option value="csv">CSV</option>
                </Select>
              </Field>
              <Button variant="secondary" loading={busy === 'download'} disabled={busy !== null} onClick={() => void run('download')}>
                <Download className="h-4 w-4" /> {t('rc.download')}
              </Button>
            </div>
            <Button variant="ghost" disabled={busy !== null} onClick={reset}>
              <RotateCcw className="h-4 w-4" /> {t('rc.reset')}
            </Button>
          </div>

          <PreviewTable preview={preview} />
        </div>
      </CardBody>
    </Card>
  );
}

function PreviewTable({ preview }: { preview: ReportPreview | null }) {
  const { t } = useI18n();
  if (!preview) return <p className="text-sm text-ink-faint">{t('rc.previewHint')}</p>;
  return (
    <div className="space-y-2" aria-live="polite">
      <div>
        <p className="text-sm font-semibold text-ink">{preview.title}</p>
        {preview.filtersText && <p className="text-xs text-ink-muted">{preview.filtersText}</p>}
        <p className="text-xs text-ink-faint">{preview.rows.length} {t('rc.of')} {preview.total} {t('rc.rows')}</p>
      </div>
      {preview.rows.length === 0 ? (
        <p className="rounded-lg bg-surface-muted/50 px-3 py-4 text-sm text-ink-muted">{t('rc.empty')}</p>
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-muted text-start text-xs text-ink-muted">
              <tr>{preview.columns.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2 text-start font-semibold">{c.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line">
              {preview.rows.map((row, i) => (
                <tr key={i}>
                  {preview.columns.map((c) => <td key={c.key} className="whitespace-nowrap px-3 py-1.5 text-ink">{cell(row[c.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {preview.truncated && <p className="text-xs text-warning">{t('rc.truncated')}</p>}
    </div>
  );
}

/** Empty values print as "-" so a blank never looks like a missing cell. */
function cell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}
