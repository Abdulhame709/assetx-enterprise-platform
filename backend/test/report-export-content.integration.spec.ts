/**
 * Integration tests — exported report CONTENT (names instead of ids, no empty
 * columns, dashboard rows, CSV safety). Real PostgreSQL (PGlite).
 */
import { createHarness, Harness } from './support/db.harness';
import { cellText, csvSafe } from '../src/infrastructure/export/cell-format';

function collect(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    stream.on('data', (c) => (data += c.toString()));
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

/** Parse a simple CSV (handles quoted cells) into rows of cells. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

describe('Report export content — integration', () => {
  let h: Harness;
  let userA: string;
  const EVIL = '=HYPERLINK("http://evil.example","x")';

  beforeAll(async () => {
    h = await createHarness();
    const u = await h.auth.register({ tenantId: h.tenantA, username: 'rpt_user', password: 'Pass123456' });
    userA = u.user.id;
    await h.assets.create({
      tenant_id: h.tenantA, name: 'Laptop X1', category_id: h.refA.category, location_id: h.refA.location,
      status_id: h.refA.status, serial_number: 'SN-12345', barcode: 'BC-98765', purchase_date: '2024-03-15',
      purchase_price: 1200, depreciation_rate: 20, useful_life: 5,
    });
    await h.assets.create({
      tenant_id: h.tenantA, name: EVIL, category_id: h.refA.category, location_id: h.refA.location, status_id: h.refA.status,
    });
  });

  async function csv(resource: 'assets' | 'movements' | 'audit' | 'dashboard', options?: Record<string, unknown>) {
    const result = await h.exportService.generate({
      tenant_id: h.tenantA, userId: userA, resource, format: 'csv', options: options as never,
    });
    return parseCsv(await collect(result.stream));
  }

  it('assets — auditor profile shows names and detail columns, never raw ids', async () => {
    const rows = await csv('assets', { profile: 'auditor' });
    const header = rows[0];
    const idx = (k: string) => header.indexOf(k);
    const labels = ['Status', 'Location', 'Serial No', 'Barcode'];
    for (const l of labels) expect(header).toContain(l);
    const laptop = rows.find((r) => r.includes('Laptop X1'))!;
    expect(laptop[idx('Serial No')]).toBe('SN-12345');
    expect(laptop[idx('Barcode')]).toBe('BC-98765');
    expect(laptop[idx('Location')]).toBe('HQ');
    expect(laptop[idx('Status')]).toBeTruthy();
    expect(laptop.join('|')).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('assets — finance profile fills purchase date and depreciation', async () => {
    const rows = await csv('assets', { profile: 'finance' });
    const header = rows[0];
    const laptop = rows.find((r) => r.includes('Laptop X1'))!;
    expect(laptop[header.indexOf('Purchase Date')]).toBe('2024-03-15');
    expect(Number(laptop[header.indexOf('Depreciation Rate')])).toBe(20);
    expect(Number(laptop[header.indexOf('Useful Life')])).toBe(5);
    expect(Number(laptop[header.indexOf('Purchase Price')])).toBe(1200);
  });

  it('CSV — a cell that starts with = is neutralised (formula injection)', async () => {
    const rows = await csv('assets');
    const cells = rows.flat();
    expect(cells).toContain(`'${EVIL}`);
    expect(cells).not.toContain(EVIL);
  });

  it('a profile built for assets falls back to real columns on another resource', async () => {
    const rows = await csv('audit', { profile: 'executive' });
    expect(rows[0].length).toBeGreaterThan(0);
    expect(rows[0]).toContain('action_type');
    expect(rows[0]).not.toContain('Asset Code');
  });

  it('audit — entity, entity id and metadata columns are populated', async () => {
    await h.audit.log({ tenant_id: h.tenantA, userId: userA, action: 'ASSET_CREATED', entity: 'asset', entityId: 'rec-1', metadata: { reason: 'test' } });
    const rows = await csv('audit');
    const header = rows[0];
    const row = rows.find((r) => r[header.indexOf('entity_id')] === 'rec-1')!;
    expect(row).toBeDefined();
    expect(row[header.indexOf('entity')]).toBe('asset');
    expect(row[header.indexOf('metadata')]).toContain('"reason":"test"');
    expect(row[header.indexOf('user_name')]).toBe('rpt_user');
  });

  it('dashboard — flat section / metric / value rows', async () => {
    const rows = await csv('dashboard');
    expect(rows[0]).toEqual(['section', 'metric', 'value']);
    const total = rows.find((r) => r[1] === 'إجمالي الأصول');
    expect(total).toBeDefined();
    expect(Number(total![2])).toBeGreaterThanOrEqual(2);
    expect(rows.flat().join('|')).not.toContain('[object Object]');
  });

  it('dashboard — total value ignores inactive assets', async () => {
    const before = await h.reporting.getAssetDashboard(h.tenantA);
    const created = await h.assets.create({
      tenant_id: h.tenantA, name: 'Gone', category_id: h.refA.category, location_id: h.refA.location,
      status_id: h.refA.status, purchase_price: 5000, quantity: 1,
    });
    await h.db.query(`UPDATE assets SET is_active = false WHERE id = $1`, [created.id]);
    const after = await h.reporting.getAssetDashboard(h.tenantA);
    expect(after.total_value).toBe(before.total_value);
  });
});

describe('cell formatting', () => {
  it('formats null, boolean, date and object cells', () => {
    expect(cellText(null)).toBe('');
    expect(cellText(true)).toBe('نعم');
    expect(cellText(false)).toBe('لا');
    expect(cellText(new Date('2025-01-02T00:00:00.000Z'))).toBe('2025-01-02');
    expect(cellText(new Date('2025-01-02T10:20:30.000Z'))).toBe('2025-01-02 10:20:30');
    expect(cellText({ a: 1 })).toBe('{"a":1}');
    expect(cellText(12.5)).toBe('12.5');
  });

  it('csvSafe prefixes formulas but keeps numbers', () => {
    expect(csvSafe('=1+1')).toBe("'=1+1");
    expect(csvSafe('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvSafe('-5')).toBe('-5');
    expect(csvSafe('+12.50')).toBe('+12.50');
    expect(csvSafe('plain')).toBe('plain');
  });
});
