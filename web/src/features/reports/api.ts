import { API_BASE_URL, http } from '@/lib/api/client';
import { currentReportLang } from '@/lib/api/report-lang';

export type ReportResource = 'assets' | 'movements' | 'inventory' | 'audit' | 'dashboard';
export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

/** Reports of the Report Center (asset-derived, filterable, viewable and printable). */
export type ReportCenterResource = 'assets' | 'asset-locations' | 'asset-types' | 'duplicates' | 'inventory-form';
type AnyReportResource = ReportResource | ReportCenterResource;

export type AssetSortKey = 'location' | 'category' | 'name' | 'status' | 'employee' | 'code' | 'price';

/**
 * Filters a Report Center report understands. `employee_id` is an employee id,
 * or 'none' for assets that have no employee. Empty values are never sent.
 */
export interface ReportFilters {
  location_id?: string;
  location_scope?: 'main' | 'sub';
  category_id?: string;
  status_id?: string;
  employee_id?: string;
  q?: string;
  sort_by?: AssetSortKey;
  sort_dir?: 'asc' | 'desc';
  blank_rows?: number;
}

export interface ReportPreview {
  resource: ReportCenterResource;
  title: string;
  organizationName: string;
  filtersText: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  total: number;
  truncated: boolean;
}

/** Query-string pairs for the filters, skipping anything empty. */
export function filterParams(filters?: ReportFilters): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (!filters) return out;
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '' || value === 0) continue;
    out.push([key, String(value)]);
  }
  return out;
}
export type ReportProfileId = 'executive' | 'finance' | 'auditor' | 'inventory' | 'compliance';

export interface ReportColumn {
  key: string;
  label: string;
  order: number;
}

export interface ReportSort {
  field: string;
  dir: 'asc' | 'desc';
}

export type ReportAggregation = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface ReportGroup {
  field: string;
  aggregate?: ReportAggregation;
  valueField?: string;
}

export interface ReportDefinition {
  id: string;
  name: string;
  resource: ReportResource;
  format: ReportFormat;
  columns: Array<{ field: string; label?: string }>;
  sorting?: ReportSort[];
  grouping?: ReportGroup[];
  filters?: Array<Record<string, unknown>>;
}

export interface ReportExportInput {
  resource: AnyReportResource;
  format: ReportFormat;
  limit?: number;
  filters?: ReportFilters;
  summary?: string;
  profile?: ReportProfileId;
  columns?: ReportColumn[];
  sorting?: ReportSort[];
  grouping?: ReportGroup[];
}

export type AiReportResource = 'assets' | 'dashboard';
export type AiSummarySource = 'llm' | 'deterministic';

export interface ReportAiSummary {
  source: AiSummarySource;
  provider: string;
  model: string | null;
  summary: string;
  key_findings: string[];
  warnings: string[];
  confidence: number;
  evidence: string[];
  generated_at: string;
}

export async function generateReportAiSummary(resource: AiReportResource): Promise<ReportAiSummary> {
  return http.post<ReportAiSummary>('/ai/reports/summary', { resource });
}

/**
 * Print the server-made PDF of a resource: it carries the organization header,
 * a real data table, page numbers and correct right-to-left layout, unlike
 * printing the on-screen page. The PDF is loaded in a hidden frame and the
 * browser print dialog is opened; if the frame cannot print, the PDF opens in a
 * new tab instead.
 */
export async function printReportExport(
  resource: AnyReportResource,
  limit = 10000,
  extra: { filters?: ReportFilters; summary?: string } = {},
): Promise<void> {
  const { tokenStore } = await import('@/lib/auth/token-store');
  const token = tokenStore.getAccess();
  const params = new URLSearchParams({ format: 'pdf', limit: String(limit), lang: currentReportLang() });
  for (const [key, value] of filterParams(extra.filters)) params.set(key, value);
  if (extra.summary) params.set('summary', extra.summary);
  const response = await fetch(`${API_BASE_URL}/exports/${resource}?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Print failed (${response.status})`);
  const blob = new Blob([await response.blob()], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  const cleanup = () => {
    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
    cleanup();
  };
  frame.src = url;
  document.body.appendChild(frame);
}

/** On-screen view of a Report Center report: the same filters and columns as the printed file. */
export async function getReportPreview(resource: ReportCenterResource, filters?: ReportFilters): Promise<ReportPreview> {
  const params = new URLSearchParams({ lang: currentReportLang() });
  for (const [key, value] of filterParams(filters)) params.set(key, value);
  const raw = (await http.get<unknown>(`/exports/preview/${resource}?${params.toString()}`)) as Record<string, unknown>;
  const columns = Array.isArray(raw.columns) ? (raw.columns as Array<Record<string, unknown>>) : [];
  return {
    resource,
    title: String(raw.title ?? ''),
    organizationName: String(raw.organizationName ?? ''),
    filtersText: String(raw.filtersText ?? ''),
    columns: columns.map((c) => ({ key: String(c.key ?? ''), label: String(c.label ?? c.key ?? '') })),
    rows: Array.isArray(raw.rows) ? (raw.rows as Array<Record<string, unknown>>) : [],
    total: Number(raw.total ?? 0),
    truncated: raw.truncated === true,
  };
}

/** Download a tenant-scoped report from the backend export stream. */
export async function downloadReportExport({ resource, format, limit = 10000, profile, columns, sorting, grouping, filters, summary }: ReportExportInput): Promise<void> {
  const { tokenStore } = await import('@/lib/auth/token-store');
  const token = tokenStore.getAccess();
  const params = new URLSearchParams({ format, limit: String(limit) });
  if (profile) params.set('profile', profile);
  if (columns && columns.length > 0) params.set('columns', JSON.stringify(columns));
  if (sorting && sorting.length > 0) params.set('sorting', JSON.stringify(sorting));
  if (grouping && grouping.length > 0) params.set('grouping', JSON.stringify(grouping));
  params.set('lang', currentReportLang());
  for (const [key, value] of filterParams(filters)) params.set(key, value);
  if (summary) params.set('summary', summary);
  const response = await fetch(`${API_BASE_URL}/exports/${resource}?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    // Read the response body (JSON { error: { message } }) so the real cause
    // of a failed export is shown instead of a generic status code.
    let detail = '';
    try {
      const body = await response.json();
      detail = typeof body?.error?.message === 'string' ? body.error.message : '';
    } catch {
      detail = '';
    }
    throw new Error(`Export failed (${response.status})${detail ? ': ' + detail.slice(0, 300) : ''}`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/.exec(disposition);
  const filename = match?.[1] ?? `${resource}-export.${format}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
