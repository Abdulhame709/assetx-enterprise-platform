import { API_BASE_URL, ApiError } from '@/lib/api/client';

export interface AssetImportIssue { row: number; code: string; message: string; }
export interface AssetImportPreviewRow { row: number; name: string; category: string; location: string; status: string; quantity: number; purchase_price: number; }
export interface AssetImportPreview { total_rows: number; valid_rows: number; invalid_rows: number; rows: AssetImportPreviewRow[]; errors: AssetImportIssue[]; }
export interface AssetImportResult extends AssetImportPreview { imported: number; skipped: number; }

export const DATA_IMPORT_RESOURCES = ['assets', 'locations', 'categories', 'statuses', 'employees'] as const;
export type DataImportResource = typeof DATA_IMPORT_RESOURCES[number];
export interface DataImportIssue { row: number; code: string; message: string; }
export interface DataImportPreviewRow { row: number; values: Record<string, string | number>; }
export interface DataImportPreview { resource: DataImportResource; total_rows: number; valid_rows: number; invalid_rows: number; rows: DataImportPreviewRow[]; errors: DataImportIssue[]; imported?: number; skipped?: number; }

async function withSession(path: string, init: RequestInit): Promise<Response> {
  const { tokenStore } = await import('@/lib/auth/token-store');
  const run = (token: string | null) => fetch(`${API_BASE_URL}${path}`, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } });
  let response = await run(tokenStore.getAccess());
  if (response.status === 401) {
    const { refreshSession } = await import('@/lib/auth/auth-service');
    const refreshed = await refreshSession();
    if (refreshed) response = await run(refreshed.accessToken);
  }
  return response;
}

async function parse<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  let message = response.statusText; let code: string | undefined; let details: Record<string, unknown> = {};
  try {
    const body = await response.json() as { message?: string; code?: string; error?: { code?: string; message?: string; details?: Record<string, unknown> } };
    message = body.error?.message ?? body.message ?? message; code = body.error?.code ?? body.code; details = body.error?.details ?? {};
  } catch { /* Preserve the safe status-text fallback for non-JSON failures. */ }
  throw new ApiError(response.status, message, code, details);
}

export async function previewAssetImport(file: File): Promise<AssetImportPreview> {
  const form = new FormData(); form.append('file', file);
  return parse<AssetImportPreview>(await withSession('/assets/import/preview', { method: 'POST', body: form }));
}

export async function executeAssetImport(file: File): Promise<AssetImportResult> {
  const form = new FormData(); form.append('file', file);
  return parse<AssetImportResult>(await withSession('/assets/import/execute', { method: 'POST', body: form }));
}

export async function downloadAssetImportTemplate(): Promise<void> {
  const response = await withSession('/assets/import/template', { method: 'GET' });
  if (!response.ok) await parse(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'assetx-assets-import-template.xlsx'; anchor.click(); URL.revokeObjectURL(url);
}

const MASTER_RESOURCE_PATH: Record<Exclude<DataImportResource, 'assets'>, string> = {
  locations: 'locations', categories: 'categories', statuses: 'statuses', employees: 'employees',
};

export function isDataImportResource(value: string | null): value is DataImportResource {
  return Boolean(value && (DATA_IMPORT_RESOURCES as readonly string[]).includes(value));
}

export async function previewDataImport(resource: DataImportResource, file: File): Promise<DataImportPreview> {
  if (resource === 'assets') {
    const result = await previewAssetImport(file);
    return { resource, total_rows: result.total_rows, valid_rows: result.valid_rows, invalid_rows: result.invalid_rows, errors: result.errors, rows: result.rows.map((row) => ({ row: row.row, values: { name: row.name, category: row.category, location: row.location, status: row.status, quantity: row.quantity } })) };
  }
  const form = new FormData(); form.append('file', file);
  return parse<DataImportPreview>(await withSession(`/master-data/import/${MASTER_RESOURCE_PATH[resource]}/preview`, { method: 'POST', body: form }));
}

export async function executeDataImport(resource: DataImportResource, file: File): Promise<DataImportPreview> {
  if (resource === 'assets') {
    const result = await executeAssetImport(file);
    return { resource, total_rows: result.total_rows, valid_rows: result.valid_rows, invalid_rows: result.invalid_rows, errors: result.errors, imported: result.imported, skipped: result.skipped, rows: result.rows.map((row) => ({ row: row.row, values: { name: row.name, category: row.category, location: row.location, status: row.status, quantity: row.quantity } })) };
  }
  const form = new FormData(); form.append('file', file);
  return parse<DataImportPreview>(await withSession(`/master-data/import/${MASTER_RESOURCE_PATH[resource]}/execute`, { method: 'POST', body: form }));
}

export async function downloadDataImportTemplate(resource: DataImportResource): Promise<void> {
  if (resource === 'assets') return downloadAssetImportTemplate();
  const response = await withSession(`/master-data/import/${MASTER_RESOURCE_PATH[resource]}/template`, { method: 'GET' });
  if (!response.ok) await parse(response);
  const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `assetx-${MASTER_RESOURCE_PATH[resource]}-import-template.xlsx`; anchor.click(); URL.revokeObjectURL(url);
}
