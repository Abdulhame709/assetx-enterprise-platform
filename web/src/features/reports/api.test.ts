import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadReportExport } from './api';

vi.mock('@/lib/api/client', () => ({
  API_BASE_URL: '/api',
}));

vi.mock('@/lib/auth/token-store', () => ({
  tokenStore: { getAccess: vi.fn(() => 'access-token') },
}));

describe('report export API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('document', {
      body: { appendChild: vi.fn() },
      createElement: vi.fn(() => anchor),
    });
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it('requests the selected report resource, format, and row limit', async () => {
    const response = new Response('id,name\n1,Printer', {
      status: 200,
      headers: { 'Content-Disposition': 'attachment; filename="inventory-export.csv"' },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response);
    await downloadReportExport({ resource: 'inventory', format: 'csv', limit: 250 });

    expect(fetch).toHaveBeenCalledWith('/api/exports/inventory?format=csv&limit=250', {
      headers: { Authorization: 'Bearer access-token' },
    });
    expect((document.createElement('a') as unknown as { click: () => void }).click).toBeDefined();
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });

  it('serializes a profile and ordered columns for ERP-style exports', async () => {
    const response = new Response('name,code\nPrinter,AST-001', {
      status: 200,
      headers: { 'Content-Disposition': 'attachment; filename="assets-export.csv"' },
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response);
    await downloadReportExport({
      resource: 'assets',
      format: 'csv',
      profile: 'auditor',
      columns: [
        { key: 'full_asset_code', label: 'Asset code', order: 1 },
        { key: 'name', label: 'Asset name', order: 2 },
      ],
    });

    const [url] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain('/api/exports/assets?format=csv&limit=10000&profile=auditor&columns=');
    expect(decodeURIComponent(String(url))).toContain('"key":"full_asset_code"');
  });

  it('surfaces a failed export response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 403 }));

    await expect(downloadReportExport({ resource: 'audit', format: 'pdf' })).rejects.toThrow('Export failed (403)');
  });
});
