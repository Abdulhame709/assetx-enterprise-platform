/**
 * Integration test for tools/db-cleanup/cleanup-name-codes.js against real
 * PostgreSQL (PGlite): dry run changes nothing, apply unifies codes, merges only
 * identical records without history, and restore brings everything back.
 */
import { createHarness, Harness } from './support/db.harness';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cleanup = require('../../tools/db-cleanup/cleanup-name-codes.js');

describe('cleanup-name-codes — integration', () => {
  let h: Harness;
  const tenant = { id: '', tenant_code: 'cleanup_t' };
  let ids: Record<string, string> = {};

  const client = () => ({ query: (sql: string, params?: unknown[]) => h.db.query(sql, params) });
  const insert = async (key: string, name: string, base: string, qty: number, notes: string | null, day: number, status?: string) => {
    const r = await h.db.query<{ id: string }>(
      `INSERT INTO assets (tenant_id, name, base_asset_code, full_asset_code, quantity, status_id, location_id, notes, created_at, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true) RETURNING id`,
      [h.tenantA, name, base, `${base}@${key}`, qty, status ?? h.refA.status, h.refA.location, notes, new Date(2026, 0, day)],
    );
    ids[key] = r.rows[0].id;
  };
  const row = async (key: string) =>
    (await h.db.query<any>(`SELECT name, base_asset_code, full_asset_code, quantity, notes, is_active FROM assets WHERE id=$1`, [ids[key]])).rows[0];

  beforeAll(async () => {
    h = await createHarness();
    tenant.id = h.tenantA;
    await h.db.setTenant(h.tenantA);
    await insert('a', 'كراسي أبو يدين', '2099-0001', 2, null, 1);
    await insert('b', 'كراسي أبو يدين (2025-0038-13@موقع)', '2099-0002', 3, null, 2); // identical twin of a → merged
    await insert('c', 'كراسي ابو يدين', '2099-0003', 4, 'ملاحظة', 3); // differs in notes → stays
    await insert('d', 'مراوح سطح', '2099-0004', 1, null, 4);
  });

  it('dry run executes and verifies but changes nothing', async () => {
    const plan = await cleanup.runTenant(client(), tenant, { apply: false });
    expect(plan.stats.merged).toBe(1);
    expect((await row('b')).is_active).toBe(true);
    expect((await row('c')).base_asset_code).toBe('2099-0003');
    expect((await row('b')).name).toContain('2025-0038');
  });

  it('apply (restricted DB user): one code per name, merge only identical, JSON backup, restore', async () => {
    const backups: any[][] = [];
    const plan = await cleanup.runTenant(client(), tenant, { apply: true }, { writeBackupFile: (_n: string, rows: any[]) => backups.push(rows) });
    expect(backups).toHaveLength(1);
    expect(plan.backupTable).toBeUndefined(); // test role may not create tables → JSON is the backup

    const a = await row('a'); const b = await row('b'); const c = await row('c'); const d = await row('d');
    expect(a.quantity).toBe(5); // 2 + 3 merged (4 is a different record)
    expect(a.notes).toContain('الكود القديم: 2025-0038-13@موقع');
    expect(b.is_active).toBe(false);
    expect(b.name).toBe('كراسي أبو يدين');
    expect([a, b, c].every((r) => r.base_asset_code === '2099-0001')).toBe(true);
    expect(c.is_active).toBe(true);
    expect(c.quantity).toBe(4);
    expect(c.notes).toBe('ملاحظة');
    expect(d.base_asset_code).toBe('2099-0004');
    const fulls = (await h.db.query<{ f: string }>(`SELECT full_asset_code AS f FROM assets WHERE base_asset_code='2099-0001'`)).rows.map((r) => r.f);
    expect(new Set(fulls).size).toBe(fulls.length);

    // a second run is a no-op
    const again = await cleanup.runTenant(client(), tenant, { apply: false });
    expect(again.changes.size).toBe(0);

    await cleanup.restoreRows(client(), JSON.parse(JSON.stringify(backups[0])));
    expect((await row('b')).is_active).toBe(true);
    expect((await row('b')).name).toContain('2025-0038');
    expect((await row('c')).base_asset_code).toBe('2099-0003');
    expect((await row('a')).quantity).toBe(2);
    expect((await row('a')).notes).toBeNull();
  });

  it('apply (owner): also creates a backup table and restores from it', async () => {
    await h.db.exec('RESET ROLE');
    const plan = await cleanup.runTenant(client(), tenant, { apply: true }, { writeBackupFile: () => undefined });
    expect(plan.backupTable).toMatch(/^assets_backup_[0-9]{8}_[0-9]{6}_cleanup_t$/);
    expect((await row('b')).is_active).toBe(false);
    await cleanup.restoreTenant(client(), plan.backupTable);
    expect((await row('b')).is_active).toBe(true);
    expect((await row('c')).base_asset_code).toBe('2099-0003');
  });
});
