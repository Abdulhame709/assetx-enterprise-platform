'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';
import { AssetImportPreview, downloadAssetImportTemplate, executeAssetImport, previewAssetImport } from '@/features/imports/asset-import-api';

export default function ImportDataPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AssetImportPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected); setPreview(null);
    if (!selected) return;
    if (!/\.xlsx$/i.test(selected.name) || selected.size > 2 * 1024 * 1024) { toast.error(t('importData.fileInvalidTitle'), t('importData.fileInvalid')); return; }
    setLoadingPreview(true);
    try { setPreview(await previewAssetImport(selected)); }
    catch (error) { toast.error(t('importData.previewFailed'), humanError(error, t('common.genericError'), locale)); }
    finally { setLoadingPreview(false); }
  };

  const downloadTemplate = async () => {
    setDownloading(true);
    try { await downloadAssetImportTemplate(); toast.success(t('module.importDownloaded'), t('module.importTemplateTitle')); }
    catch (error) { toast.error(t('common.exportFailed'), humanError(error, t('common.genericError'), locale)); }
    finally { setDownloading(false); }
  };

  const execute = async () => {
    if (!file || !preview || preview.invalid_rows > 0 || preview.valid_rows === 0) return;
    setExecuting(true);
    try {
      const result = await executeAssetImport(file);
      setPreview(result);
      toast.success(t('importData.completeTitle'), `${result.imported.toLocaleString(locale)} ${t('importData.imported')}`);
    } catch (error) { toast.error(t('importData.executeFailed'), humanError(error, t('common.genericError'), locale)); }
    finally { setExecuting(false); }
  };

  const reset = () => { setFile(null); setPreview(null); if (inputRef.current) inputRef.current.value = ''; };

  return <div className="space-y-4">
    <PageHeader title={t('nav.importData')} subtitle={t('module.importSubtitle')} actions={<Button variant="secondary" size="sm" loading={downloading} onClick={() => void downloadTemplate()}><Download className="h-4 w-4" /> {t('importData.downloadTemplate')}</Button>} />
    <section className="grid gap-4 xl:grid-cols-[1.05fr_1.95fr]">
      <Card className="h-fit shadow-card"><CardHeader title={t('importData.uploadTitle')} subtitle={t('importData.uploadSubtitle')} /><CardBody className="space-y-4">
        <input ref={inputRef} className="sr-only" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void selectFile(event)} />
        <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center rounded-xl border border-dashed border-brand/35 bg-brand-soft/40 px-5 py-8 text-center transition-colors hover:bg-brand-soft focus:outline-none focus:ring-2 focus:ring-brand">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-raised text-brand shadow-card"><FileSpreadsheet className="h-5 w-5" /></span><span className="mt-3 text-sm font-semibold text-ink">{file ? file.name : t('importData.chooseFile')}</span><span className="mt-1 text-xs text-ink-muted">{t('importData.fileHint')}</span>
        </button>
        <div className="rounded-lg border border-line bg-surface-muted/60 p-3 text-xs leading-6 text-ink-muted"><p className="font-semibold text-ink">{t('importData.safeModeTitle')}</p><p>{t('importData.safeModeDescription')}</p></div>
        {file && <Button variant="ghost" size="sm" className="w-full" onClick={reset}><RefreshCw className="h-3.5 w-3.5" /> {t('importData.changeFile')}</Button>}
      </CardBody></Card>

      <Card className="overflow-hidden shadow-card"><CardHeader title={t('importData.previewTitle')} subtitle={t('importData.previewSubtitle')} /><CardBody>
        {loadingPreview && <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-ink-muted"><RefreshCw className="h-4 w-4 animate-spin" /> {t('importData.reading')}</div>}
        {!loadingPreview && !preview && <EmptyState title={t('importData.noPreviewTitle')} description={t('importData.noPreviewDescription')} />}
        {!loadingPreview && preview && <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3"><ImportMetric label={t('importData.totalRows')} value={preview.total_rows} tone="brand" /><ImportMetric label={t('importData.validRows')} value={preview.valid_rows} tone="success" /><ImportMetric label={t('importData.invalidRows')} value={preview.invalid_rows} tone={preview.invalid_rows ? 'danger' : 'neutral'} /></div>
          {preview.errors.length > 0 && <div className="rounded-xl border border-danger/25 bg-danger-soft/45 p-3"><div className="flex items-center gap-2 text-sm font-semibold text-danger"><AlertTriangle className="h-4 w-4" /> {t('importData.errorsTitle')}</div><ul className="mt-2 space-y-1 text-xs text-danger">{preview.errors.map((issue, index) => <li key={`${issue.row}-${issue.code}-${index}`}>{t('importData.row')} {issue.row}: {issue.message}</li>)}</ul></div>}
          {preview.rows.length > 0 && <div className="overflow-x-auto rounded-xl border border-line"><table className="min-w-full text-sm"><thead className="bg-surface-muted text-xs text-ink-muted"><tr><th className="px-3 py-2 text-start">#</th><th className="px-3 py-2 text-start">{t('common.name')}</th><th className="px-3 py-2 text-start">{t('common.type')}</th><th className="px-3 py-2 text-start">{t('common.location')}</th><th className="px-3 py-2 text-start">{t('common.status')}</th><th className="px-3 py-2 text-center">{t('common.quantity')}</th></tr></thead><tbody className="divide-y divide-line">{preview.rows.map((row) => <tr key={row.row}><td className="px-3 py-2 font-mono text-xs text-ink-faint">{row.row}</td><td className="px-3 py-2 font-medium text-ink">{row.name}</td><td className="px-3 py-2 text-ink-muted">{row.category}</td><td className="px-3 py-2 text-ink-muted">{row.location}</td><td className="px-3 py-2 text-ink-muted">{row.status}</td><td className="px-3 py-2 text-center tabular-nums text-ink">{row.quantity}</td></tr>)}</tbody></table></div>}
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4"><Button variant="secondary" size="sm" onClick={reset}>{t('common.cancel')}</Button><Button variant="primary" size="sm" disabled={preview.invalid_rows > 0 || preview.valid_rows === 0} loading={executing} onClick={() => void execute()}><Upload className="h-4 w-4" /> {t('importData.importSelected')}</Button></div>
        </div>}
      </CardBody></Card>
    </section>
  </div>;
}

function ImportMetric({ label, value, tone }: { label: string; value: number; tone: 'brand' | 'success' | 'danger' | 'neutral' }) { const color = { brand: 'text-brand', success: 'text-success', danger: 'text-danger', neutral: 'text-ink' }[tone]; return <div className="rounded-lg border border-line bg-surface p-3"><p className="text-xs text-ink-muted">{label}</p><p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p></div>; }
