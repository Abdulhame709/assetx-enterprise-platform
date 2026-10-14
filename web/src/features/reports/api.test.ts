import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadReportExport, filterParams, generateReportAiSummary, getReportPreview } from './api';
import { http } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  API_BASE_URL: '/api',
  http: { post: vi.fn(), get: vi.fn() },
}));

vi.mock('@/lib/auth/token-store', () => ({
  tokenStore: { getAccess: vi.fn(() => 'access-token') },
}));

describe('report export API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(http.post).mockReset();
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

    expect(fetch).toHaveBeenCalledWith('/api/exports/inventory?format=csv&limit=250&lang=ar', {
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

  it('serializes sorting and grouping metadata for real aggregation exports', async () => {
    const response = new Response('location_id,count\\nloc-1,3', { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response);
    await downloadReportExport({
      resource: 'assets',
      format: 'xlsx',
      sorting: [{ field: 'count', dir: 'desc' }],
      grouping: [{ field: 'location_id', aggregate: 'count' }, { field: 'location_id', aggregate: 'sum', valueField: 'purchase_price' }],
    });
    const [url] = vi.mocked(fetch).mock.calls[0] ?? [];
    const decoded = decodeURIComponent(String(url));
    expect(decoded).toContain('sorting=[{"field":"count","dir":"desc"}]');
    expect(decoded).toContain('"aggregate":"sum"');
    expect(decoded).toContain('"valueField":"purchase_price"');
  });

  it('requests a tenant-scoped AI summary for the supported report resource', async () => {
    const summary = {
      source: 'deterministic' as const,
      provider: 'assetx-rules',
      model: null,
      summary: 'ملخص تجريبي',
      key_findings: ['إجمالي الأصول: 2'],
      warnings: [],
      confidence: 1,
      evidence: ['total_assets=2'],
      generated_at: '2026-08-22T00:00:00.000Z',
    };
    vi.mocked(http.post).mockResolvedValueOnce(summary);

    await expect(generateReportAiSummary('assets')).resolves.toEqual(summary);
    expect(http.post).toHaveBeenCalledWith('/ai/reports/summary', { resource: 'assets' });
  });

  it('sends the report filters, an employee of "none", and the AI summary with the file request', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('x', { status: 200 }));
    await downloadReportExport({
      resource: 'assets',
      format: 'pdf',
      filters: { location_id: 'loc-1', employee_id: 'none', sort_by: 'name', sort_dir: 'desc', q: '' },
      summary: 'ملخص',
    });
    const [url] = vi.mocked(fetch).mock.calls[0] ?? [];
    const params = new URL(String(url), 'http://x').searchParams;
    expect(params.get('location_id')).toBe('loc-1');
    expect(params.get('employee_id')).toBe('none');
    expect(params.get('sort_by')).toBe('name');
    expect(params.get('sort_dir')).toBe('desc');
    expect(params.get('summary')).toBe('ملخص');
    expect(params.has('q')).toBe(false);
  });

  it('never sends empty filters', () => {
    expect(filterParams({ location_id: '', q: undefined, blank_rows: 0, category_id: 'c1' })).toEqual([['category_id', 'c1']]);
    expect(filterParams(undefined)).toEqual([]);
  });

  it('maps the on-screen preview of a report', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({
      title: 'تقرير الأصول', organizationName: 'شركة', filtersText: 'الموقع: أ',
      columns: [{ key: 'name', label: 'اسم الأصل' }], rows: [{ name: 'طابعة' }], total: 450, truncated: true,
    });
    const preview = await getReportPreview('assets', { location_id: 'loc-1' });
    expect(vi.mocked(http.get).mock.calls[0]?.[0]).toBe('/exports/preview/assets?lang=ar&location_id=loc-1');
    expect(preview).toMatchObject({ resource: 'assets', total: 450, truncated: true });
    expect(preview.columns).toEqual([{ key: 'name', label: 'اسم الأصل' }]);
  });

  it('surfaces a failed export response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('', { status: 403 }));

    await expect(downloadReportExport({ resource: 'audit', format: 'pdf' })).rejects.toThrow('Export failed (403)');
  });

  it('includes the backend reason when an export fails with a JSON error body', async () => {
    const body = { error: { message: 'EXPORT_FAILED: syntax error at or near "es"' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 400 }));

    await expect(downloadReportExport({ resource: 'inventory', format: 'csv' })).rejects.toThrow(
      'Export failed (400): EXPORT_FAILED: syntax error at or near "es"',
    );
  });
});
