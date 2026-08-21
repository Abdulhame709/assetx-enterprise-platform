import { API_BASE_URL } from '@/lib/api/client';

export type ReportResource = 'assets' | 'movements' | 'inventory' | 'audit' | 'dashboard';
export type ReportFormat = 'csv' | 'xlsx' | 'pdf';
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
  resource: ReportResource;
  format: ReportFormat;
  limit?: number;
  profile?: ReportProfileId;
  columns?: ReportColumn[];
  sorting?: ReportSort[];
  grouping?: ReportGroup[];
}

/** Download a tenant-scoped report from the backend export stream. */
export async function downloadReportExport({ resource, format, limit = 10000, profile, columns, sorting, grouping }: ReportExportInput): Promise<void> {
  const { tokenStore } = await import('@/lib/auth/token-store');
  const token = tokenStore.getAccess();
  const params = new URLSearchParams({ format, limit: String(limit) });
  if (profile) params.set('profile', profile);
  if (columns && columns.length > 0) params.set('columns', JSON.stringify(columns));
  if (sorting && sorting.length > 0) params.set('sorting', JSON.stringify(sorting));
  if (grouping && grouping.length > 0) params.set('grouping', JSON.stringify(grouping));
  const response = await fetch(`${API_BASE_URL}/exports/${resource}?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);

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
