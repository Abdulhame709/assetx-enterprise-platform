/**
 * Demo dataset bootstrap (RC1 stabilization — D3).
 * Reproducible QA/product-preview data for the demo tenant: hierarchical
 * locations, categories, asset models, statuses, employees, assets, movements,
 * an in-progress inventory cycle with records, notifications and audit events.
 *
 * - Deterministic (fixed names/codes) and idempotent: guarded by "assets
 *   already exist for the tenant" so repeated boots never duplicate data.
 * - Enabled at runtime boot when `ASSETX_SEED_DEMO=1` (documented in
 *   DEVELOPER_SETUP.md / DEMO_CREDENTIALS.md). Tests boot their own databases
 *   and are not affected.
 * - No schema changes; uses only existing tables/columns (migrations 001–003).
 */
import { PGliteDatabase } from '../infrastructure/database/pglite.database';

/** Locations tree: [name, path, fullPath, type, level, parentPath|null]. */
const LOCATIONS: Array<[string, string, string, string, number, string | null]> = [
  ['HQ', 'hq', 'HQ', 'building', 0, null],
  ['Floor 1', 'hq.floor-1', 'HQ / Floor 1', 'room', 1, 'hq'],
  ['Room 101', 'hq.floor-1.room-101', 'HQ / Floor 1 / Room 101', 'room', 2, 'hq.floor-1'],
  ['Room 102', 'hq.floor-1.room-102', 'HQ / Floor 1 / Room 102', 'room', 2, 'hq.floor-1'],
  ['Floor 2', 'hq.floor-2', 'HQ / Floor 2', 'room', 1, 'hq'],
  ['Room 201', 'hq.floor-2.room-201', 'HQ / Floor 2 / Room 201', 'room', 2, 'hq.floor-2'],
  ['Warehouse', 'warehouse', 'Warehouse', 'warehouse', 0, null],
  ['Rack A', 'warehouse.rack-a', 'Warehouse / Rack A', 'warehouse', 1, 'warehouse'],
  ['Rack B', 'warehouse.rack-b', 'Warehouse / Rack B', 'warehouse', 1, 'warehouse'],
];

const CATEGORIES = ['IT', 'Furniture', 'Vehicles', 'Machinery'];
const STATUSES: Array<[string, string]> = [
  ['Good', '#27ae60'],
  ['Maintenance', '#e67e22'],
  ['Retired', '#95a5a6'],
];
const MODELS: Array<[string, string]> = [
  ['Laptop Pro 14', 'IT'],
  ['Desktop Workstation', 'IT'],
  ['Laser Printer', 'IT'],
  ['Office Desk', 'Furniture'],
  ['Delivery Van', 'Vehicles'],
  ['Rack Server Unit', 'IT'],
];
const EMPLOYEES: Array<[string, string, string]> = [
  ['Sara Al-Ahmad', 'IT', 'sara.al-ahmad@assetx.io'],
  ['Omar Haddad', 'Finance', 'omar.haddad@assetx.io'],
  ['Layla Mansour', 'Operations', 'layla.mansour@assetx.io'],
  ['Khalid Nasser', 'Facilities', 'khalid.nasser@assetx.io'],
  ['Noura Fares', 'HR', 'noura.fares@assetx.io'],
  ['Tariq Zaid', 'Logistics', 'tariq.zaid@assetx.io'],
];

/** [name, category, locationPath, employeeIdx|null, status, price, serial, barcode] */
const ASSETS: Array<[string, string, string, number | null, string, number, string, string]> = [
  ['Laptop X1', 'IT', 'hq.floor-1.room-101', 0, 'Good', 4500, 'SN-DEMO-0001', 'BC-DEMO-0001'],
  ['Laptop X2', 'IT', 'hq.floor-1.room-101', 0, 'Good', 5200, 'SN-DEMO-0002', 'BC-DEMO-0002'],
  ['Laptop X3', 'IT', 'hq.floor-2.room-201', 4, 'Good', 4800, 'SN-DEMO-0003', 'BC-DEMO-0003'],
  ['Desktop WS-1', 'IT', 'hq.floor-1.room-102', 1, 'Good', 3200, 'SN-DEMO-0004', 'BC-DEMO-0004'],
  ['Desktop WS-2', 'IT', 'hq.floor-1.room-102', null, 'Maintenance', 3100, 'SN-DEMO-0005', 'BC-DEMO-0005'],
  ['Printer P1', 'IT', 'hq.floor-1.room-101', null, 'Good', 900, 'SN-DEMO-0006', 'BC-DEMO-0006'],
  ['Printer P2', 'IT', 'hq.floor-2.room-201', null, 'Good', 1100, 'SN-DEMO-0007', 'BC-DEMO-0007'],
  ['Server R1', 'IT', 'warehouse.rack-a', 2, 'Good', 18000, 'SN-DEMO-0008', 'BC-DEMO-0008'],
  ['Server R2', 'IT', 'warehouse.rack-a', null, 'Maintenance', 19500, 'SN-DEMO-0009', 'BC-DEMO-0009'],
  ['Desk D1', 'Furniture', 'hq.floor-1.room-101', 0, 'Good', 350, 'SN-DEMO-0010', 'BC-DEMO-0010'],
  ['Desk D2', 'Furniture', 'hq.floor-1.room-102', 1, 'Good', 350, 'SN-DEMO-0011', 'BC-DEMO-0011'],
  ['Desk D3', 'Furniture', 'hq.floor-2.room-201', 4, 'Good', 380, 'SN-DEMO-0012', 'BC-DEMO-0012'],
  ['Van V1', 'Vehicles', 'warehouse.rack-b', 5, 'Good', 32000, 'SN-DEMO-0013', 'BC-DEMO-0013'],
  ['Van V2', 'Vehicles', 'warehouse.rack-b', null, 'Good', 35000, 'SN-DEMO-0014', 'BC-DEMO-0014'],
  ['Forklift F1', 'Machinery', 'warehouse.rack-b', 5, 'Good', 45000, 'SN-DEMO-0015', 'BC-DEMO-0015'],
  ['Generator G1', 'Machinery', 'warehouse.rack-a', 2, 'Maintenance', 22000, 'SN-DEMO-0016', 'BC-DEMO-0016'],
];

/**
 * Seed the demo dataset for the demo tenant. Idempotent — no-op when the
 * tenant already has assets (prevents duplication on repeated boot).
 */
export async function seedDemoData(db: PGliteDatabase, tenantId: string): Promise<void> {
  const existing = await db.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM assets WHERE tenant_id = $1`,
    [tenantId],
  );
  if (Number(existing.rows[0]?.c ?? 0) > 0) return;

  const admin = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE tenant_id = $1 AND username = 'admin' LIMIT 1`,
    [tenantId],
  );
  const adminId = admin.rows[0]?.id ?? null;

  // Categories (UNIQUE tenant_id+name) / statuses / models
  for (const name of CATEGORIES) {
    await db.query(
      `INSERT INTO asset_categories (tenant_id, name) VALUES ($1, $2)
       ON CONFLICT (tenant_id, name) DO NOTHING`,
      [tenantId, name],
    );
  }
  for (const [name, color] of STATUSES) {
    await db.query(
      `INSERT INTO statuses (tenant_id, name, color) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, name) DO NOTHING`,
      [tenantId, name, color],
    );
  }
  for (const [name, cat] of MODELS) {
    await db.query(
      `INSERT INTO asset_models (tenant_id, category_id, name)
       SELECT $1, c.id, $2 FROM asset_categories c
        WHERE c.tenant_id = $1 AND c.name = $3
       ON CONFLICT (tenant_id, name) DO NOTHING`,
      [tenantId, name, cat],
    );
  }

  // Locations (no unique constraint — guard by path existence)
  const locIdByPath = new Map<string, string>();
  for (const [name, path, fullPath, type, level, parentPath] of LOCATIONS) {
    const found = await db.query<{ id: string }>(
      `SELECT id FROM locations WHERE tenant_id = $1 AND path = $2 LIMIT 1`,
      [tenantId, path],
    );
    if (found.rows[0]) {
      locIdByPath.set(path, found.rows[0].id);
      continue;
    }
    const parentId = parentPath ? locIdByPath.get(parentPath) ?? null : null;
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO locations (tenant_id, parent_id, name, location_type, path, full_path, level_number)
       VALUES ($1, $2, $3, $4::location_type, $5, $6, $7) RETURNING id`,
      [tenantId, parentId, name, type, path, fullPath, level],
    );
    locIdByPath.set(path, rows[0].id);
  }

  // Employees (no unique — guard by email)
  const empIdByName = new Map<string, string>();
  for (const [name, dept, email] of EMPLOYEES) {
    const found = await db.query<{ id: string }>(
      `SELECT id FROM employees WHERE tenant_id = $1 AND email = $2 LIMIT 1`,
      [tenantId, email],
    );
    if (found.rows[0]) {
      empIdByName.set(name, found.rows[0].id);
      continue;
    }
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO employees (tenant_id, name, department, email) VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, name, dept, email],
    );
    empIdByName.set(name, rows[0].id);
  }

  // Assets (UNIQUE full_asset_code)
  const assetIdByName = new Map<string, string>();
  let seq = 1;
  for (const [name, cat, locPath, empIdx, status, price, serial, barcode] of ASSETS) {
    const locId = locIdByPath.get(locPath);
    const base = `2026-${String(seq).padStart(4, '0')}`;
    const slug = locPath.split('.').pop() ?? 'loc';
    const full = `${base}@${slug}`;
    const empId = empIdx !== null ? empIdByName.get(EMPLOYEES[empIdx][0]) ?? null : null;
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO assets
         (tenant_id, name, base_asset_code, full_asset_code, category_id, model_id,
          location_id, quantity, status_id, employee_id, purchase_price, purchase_date,
          depreciation_rate, useful_life, serial_number, barcode, reference_number,
          inventory_year, notes, created_by)
       SELECT $1, $2, $3, $4, c.id, m.id, $5, 1, s.id, $6, $7, '2025-03-01'::date, 20, 5,
              $8, $9, $10, 2026, 'Demo dataset (RC1 stabilization)', $11
         FROM asset_categories c
         JOIN statuses s ON s.tenant_id = c.tenant_id AND s.name = $12
         LEFT JOIN LATERAL (
           SELECT am.id FROM asset_models am
            WHERE am.tenant_id = c.tenant_id AND am.category_id = c.id AND am.is_active
            ORDER BY am.name LIMIT 1
         ) m ON true
        WHERE c.tenant_id = $1 AND c.name = $13
       ON CONFLICT (full_asset_code) DO NOTHING
       RETURNING id`,
      [tenantId, name, base, full, locId, empId, price, serial, barcode,
        `REF-DEMO-${String(seq).padStart(3, '0')}`, adminId, status, cat],
    );
    if (rows[0]) assetIdByName.set(name, rows[0].id);
    seq++;
  }

  // Movements: one pending transfer + one approved assignment (workflow demo)
  const firstId = assetIdByName.get('Laptop X1');
  const secondId = assetIdByName.get('Desktop WS-1');
  if (firstId) {
    await db.query(
      `INSERT INTO asset_movements
         (tenant_id, asset_id, movement_type, from_location_id, to_location_id,
          reason, reference_number, performed_by, status, created_at)
       VALUES ($1, $2, 'transfer', $3, $4, 'Demo transfer pending approval (RC1)',
               'MV-DEMO-001', $5, 'pending', now())`,
      [tenantId, firstId, locIdByPath.get('hq.floor-1.room-101'), locIdByPath.get('warehouse.rack-a'), adminId],
    );
  }
  if (secondId) {
    await db.query(
      `INSERT INTO asset_movements
         (tenant_id, asset_id, movement_type, from_location_id, to_employee_id,
          reason, reference_number, performed_by, status, approved_by, approved_at, created_at)
       VALUES ($1, $2, 'assignment', $3, $4, 'Demo assignment approved (RC1)',
               'MV-DEMO-002', $5, 'approved', $5, now(), now() - interval '2 days')`,
      [tenantId, secondId, locIdByPath.get('hq.floor-1.room-102'), empIdByName.get('Sara Al-Ahmad'), adminId],
    );
  }

  // Inventory cycle 2026 (in_progress) + snapshot records with partial counts
  await db.query(
    `INSERT INTO inventory_cycles (tenant_id, year, status, start_date, created_by)
     VALUES ($1, 2026, 'in_progress', now()::date, $2)
     ON CONFLICT (tenant_id, year) DO NOTHING`,
    [tenantId, adminId],
  );
  const cycle = await db.query<{ id: string }>(
    `SELECT id FROM inventory_cycles WHERE tenant_id = $1 AND year = 2026 LIMIT 1`,
    [tenantId],
  );
  const cycleId = cycle.rows[0]?.id;
  if (cycleId) {
    // Snapshot every demo asset as expected; count ~2/3 of them (one extra → variance demo)
    for (const [name, , locPath, , status] of ASSETS) {
      const assetId = assetIdByName.get(name);
      if (!assetId) continue;
      const expectedLoc = locIdByPath.get(locPath);
      const statusId = await db.query<{ id: string }>(
        `SELECT id FROM statuses WHERE tenant_id = $1 AND name = $2 LIMIT 1`, [tenantId, status],
      );
      const seqNo = Number(name.replace(/\D+/g, '')) || 1;
      const isCounted = seqNo % 3 !== 0;
      await db.query(
        `INSERT INTO inventory_records
           (tenant_id, cycle_id, asset_id, expected_location_id, expected_quantity,
            expected_status_id, actual_location_id, actual_quantity, inventory_date, inventory_by)
         VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9)
         ON CONFLICT (cycle_id, asset_id) DO NOTHING`,
        [tenantId, cycleId, assetId, expectedLoc, statusId.rows[0]?.id ?? null,
          isCounted ? expectedLoc : null,
          isCounted ? (name === 'Laptop X2' ? 2 : 1) : null, // Laptop X2 → extra (variance demo)
          isCounted ? '2026-08-05' : null,
          isCounted ? adminId : null],
      );
    }
  }

  // Notifications (demo inbox: 2 unread + 1 read)
  if (adminId) {
    const now = new Date().toISOString();
    const notes = [
      ['Movement pending approval', 'New movement pending your approval: Laptop X1 transfer.', 1, null],
      ['Inventory cycle 2026', 'Inventory cycle 2026 is in progress — sample records counted.', 6, null],
      ['Export completed', 'Export completed: assets.csv was generated.', 12, now],
    ] as Array<[string, string, number, string | null]>;
    for (const [title, body, hoursAgo, readAt] of notes) {
      await db.query(
        `INSERT INTO notifications (tenant_id, user_id, channel, status, payload, read_at, created_at)
         VALUES ($1, $2, 'push', 'queued', $3::jsonb, $4, now() - ($5 || ' hours')::interval)`,
        [tenantId, adminId, JSON.stringify({ title, body }), readAt, String(hoursAgo)],
      );
    }
  }

  // Audit trail (demo events using the official event catalog keys)
  const auditRows: Array<[string, string, string, string]> = [
    ['ASSET_CREATED', 'assets', 'demo-seed', 'Demo asset estate created (RC1 stabilization).'],
    ['MOVEMENT_CREATED', 'asset_movements', 'MV-DEMO-001', 'Pending transfer created for demo.'],
    ['MOVEMENT_APPROVED', 'asset_movements', 'MV-DEMO-002', 'Assignment approved (demo).'],
    ['INVENTORY_CREATED', 'inventory_cycles', '2026', 'Demo cycle 2026 created with snapshot.'],
    ['INVENTORY_STARTED', 'inventory_cycles', '2026', 'Demo cycle 2026 started.'],
    ['INVENTORY_RECORD_VERIFIED', 'inventory_records', 'demo-seed', 'Sample records counted for demo.'],
    ['AUTH_LOGIN_SUCCESS', 'users', 'admin', 'Demo admin login (RC1 preview).'],
  ];
  for (const [action, table, recordId, note] of auditRows) {
    await db.query(
      `INSERT INTO audit_events (tenant_id, user_id, action_type, table_name, record_id, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [tenantId, adminId, action, table, recordId, JSON.stringify({ note, source: 'demo-seed' })],
    );
  }
}
