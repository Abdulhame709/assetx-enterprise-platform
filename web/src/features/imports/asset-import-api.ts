import { API_BASE_URL, ApiError } from '@/lib/api/client';

export interface AssetImportIssue { row: number; code: string; message: string; }
export interface AssetImportPreviewRow { row: number; name: string; category: string; location: string; status: string; quantity: number; purchase_price: number; }
export interface AssetImportPreview { total_rows: number; valid_rows: number; invalid_rows: number; rows: AssetImportPreviewRow[]; errors: AssetImportIssue[]; }
export interface AssetImportResult extends AssetImportPreview { imported: number; skipped: number; }

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
