import { API_BASE_URL } from '@/lib/api/client';

export type ReportResource = 'assets' | 'movements' | 'inventory' | 'audit' | 'dashboard';
export type ReportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ReportExportInput {
  resource: ReportResource;
  format: ReportFormat;
  limit?: number;
}

/** Download a tenant-scoped report from the backend export stream. */
export async function downloadReportExport({ resource, format, limit = 10000 }: ReportExportInput): Promise<void> {
  const { tokenStore } = await import('@/lib/auth/token-store');
  const token = tokenStore.getAccess();
  const params = new URLSearchParams({ format, limit: String(limit) });
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
