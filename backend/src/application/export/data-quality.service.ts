/**
 * DataQualityService — loads the asset register for one tenant, runs the pure
 * checks in data-quality.ts and shapes the findings into report rows (names
 * instead of ids, issue text in the report language). Read-only.
 *
 * One report ("check") per kind of mistake; the same checks feed the counts
 * shown on the Reports page ("summary").
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { DATABASE_PORT } from '../../core/ports/tokens';
import { ExportResource } from '../../core/entities/export.entity';
import { isoDate, loadNameMaps, nameOf, statusName } from './export-lookups';
import {
  DqAsset, DqFinding, DqLang, DqMovement, SeenObservation,
  findAnomalies, findDuplicateIdentifiers, findInconsistentNaming, findMissingEssentials, findStale,
  findSuspiciousMovements, isAssignedStatusName, issuesText,
} from './data-quality';

export const DQ_RESOURCES = [
  'dq-duplicate-ids', 'dq-missing-fields', 'dq-naming', 'dq-anomalies', 'dq-stale', 'dq-movements',
] as const satisfies readonly ExportResource[];
export type DataQualityResource = typeof DQ_RESOURCES[number];

export function isDataQualityResource(value: string): value is DataQualityResource {
  return (DQ_RESOURCES as readonly string[]).includes(value);
}

/** Days without being seen before an asset is "stale". */
export const DEFAULT_STALE_DAYS = 365;
/** How far back the movement check looks. */
export const DEFAULT_MOVEMENT_DAYS = 90;
export const MAX_DAYS = 3650;

export interface DataQualityOptions {
  /** stale: days not seen (default 365); movements: look-back window (default 90) */
  days?: number;
  lang?: DqLang;
  now?: Date;
}

type Row = Record<string, unknown>;
type Names = Awaited<ReturnType<typeof loadNameMaps>>;

interface AssetRecord {
  id: string;
  name: string;
  base_asset_code: string | null;
  category_id: string | null;
  location_id: string | null;
  status_id: string | null;
  employee_id: string | null;
  quantity: string | number | null;
  purchase_price: string | number | null;
  purchase_date: string | Date | null;
  serial_number: string | null;
  barcode: string | null;
  created_at: string | Date | null;
}

function ts(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

@Injectable()
export class DataQualityService {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  /** Report rows for one check. */
  async rows(tenantId: string, resource: DataQualityResource, opts: DataQualityOptions = {}): Promise<Row[]> {
    await this.db.setTenant(tenantId);
    const names = await loadNameMaps(this.db, tenantId);
    return this.build(tenantId, resource, names, opts);
  }

  /** Number of report rows per check — a cheap overview for the Reports page. */
  async summary(
    tenantId: string,
    opts: { staleDays?: number; movementDays?: number; now?: Date } = {},
  ): Promise<Record<DataQualityResource, number>> {
    await this.db.setTenant(tenantId);
    const names = await loadNameMaps(this.db, tenantId);
    const shared = await this.loadAssets(tenantId, names);
    const counts = {} as Record<DataQualityResource, number>;
    for (const resource of DQ_RESOURCES) {
      const days = resource === 'dq-stale' ? opts.staleDays : resource === 'dq-movements' ? opts.movementDays : undefined;
      counts[resource] = (await this.build(tenantId, resource, names, { lang: 'en', now: opts.now, ...(days ? { days } : {}) }, shared)).length;
    }
    return counts;
  }

  private async build(
    tenantId: string,
    resource: DataQualityResource,
    names: Names,
    opts: DataQualityOptions,
    loaded?: { assets: DqAsset[]; assignedStatusIds: Set<string> },
  ): Promise<Row[]> {
    const lang: DqLang = opts.lang === 'en' ? 'en' : 'ar';
    const now = opts.now ?? new Date();
    if (resource === 'dq-movements') return this.movementRows(tenantId, names, lang, now, opts.days ?? DEFAULT_MOVEMENT_DAYS);
    const { assets, assignedStatusIds } = loaded ?? await this.loadAssets(tenantId, names);
    switch (resource) {
      case 'dq-duplicate-ids':
        return findDuplicateIdentifiers(assets).map((f) => this.assetRow(f, names, lang));
      case 'dq-missing-fields':
        return findMissingEssentials(assets, { assignedStatusIds }).map((f) => this.assetRow(f, names, lang));
      case 'dq-naming':
        return findInconsistentNaming(assets).map((f) => this.assetRow(f, names, lang));
      case 'dq-anomalies':
        return findAnomalies(assets, now).map((f) => this.assetRow(f, names, lang));
      case 'dq-stale': {
        const seen = await this.loadSeen(tenantId);
        return findStale(assets, seen, now, opts.days ?? DEFAULT_STALE_DAYS).map((f) => ({
          ...this.assetRow({ item: f.item.asset, issues: f.issues }, names, lang),
          last_seen: f.item.last_seen,
          last_seen_source: SEEN_SOURCE_TEXT[f.item.source][lang],
          days_since: f.item.days_since,
        }));
      }
      default:
        return [];
    }
  }

  private assetRow(f: DqFinding<DqAsset>, names: Names, lang: DqLang): Row {
    const a = f.item;
    return {
      ...(f.group_no !== undefined ? { group_no: f.group_no } : {}),
      issue: issuesText(f.issues, lang),
      base_asset_code: a.base_asset_code,
      name: a.name,
      serial_number: a.serial_number ?? '',
      barcode: a.barcode ?? '',
      category_name: nameOf(names.categories, a.category_id),
      location_name: nameOf(names.locations, a.location_id),
      employee_name: nameOf(names.employees, a.employee_id),
      status_name: statusName(names.statuses, a.status_id, lang),
      quantity: a.quantity,
      purchase_price: a.purchase_price,
      purchase_date: a.purchase_date ? a.purchase_date.slice(0, 10) : '',
    };
  }

  private async loadAssets(tenantId: string, names: Names): Promise<{ assets: DqAsset[]; assignedStatusIds: Set<string> }> {
    const { rows } = await this.db.query<AssetRecord>(
      `SELECT id, name, base_asset_code, category_id, location_id, status_id, employee_id, quantity, purchase_price,
              purchase_date, serial_number, barcode, created_at
       FROM assets WHERE tenant_id = $1 AND is_active = true ORDER BY name, base_asset_code`,
      [tenantId],
    );
    const assets: DqAsset[] = rows.map((r) => ({
      id: r.id,
      name: r.name ?? '',
      base_asset_code: r.base_asset_code ?? '',
      category_id: r.category_id,
      location_id: r.location_id,
      status_id: r.status_id,
      // "not linked to an employee" stand-ins are not custodians (names.employees leaves them out)
      employee_id: r.employee_id && names.employees.has(r.employee_id) ? r.employee_id : null,
      quantity: Number(r.quantity ?? 0),
      purchase_price: Number(r.purchase_price ?? 0),
      purchase_date: r.purchase_date ? isoDate(r.purchase_date) : null,
      serial_number: r.serial_number,
      barcode: r.barcode,
      created_at: ts(r.created_at),
    }));
    const assignedStatusIds = new Set<string>();
    for (const [id, name] of names.statuses) if (isAssignedStatusName(name)) assignedStatusIds.add(id);
    return { assets, assignedStatusIds };
  }

  /** Latest inventory count / verification and latest live movement per asset. */
  private async loadSeen(tenantId: string): Promise<SeenObservation[]> {
    const out: SeenObservation[] = [];
    const take = (rows: Array<{ asset_id: string; at: unknown }>, source: SeenObservation['source']) => {
      for (const r of rows) {
        const at = ts(r.at);
        if (at) out.push({ asset_id: r.asset_id, at, source });
      }
    };
    take((await this.db.query<{ asset_id: string; at: unknown }>(
      `SELECT asset_id, MAX(inventory_date) AS at FROM inventory_records
       WHERE tenant_id = $1 AND inventory_date IS NOT NULL GROUP BY asset_id`, [tenantId])).rows, 'inventory');
    take((await this.db.query<{ asset_id: string; at: unknown }>(
      `SELECT asset_id, MAX(verified_date) AS at FROM inventory_records
       WHERE tenant_id = $1 AND is_verified = true AND verified_date IS NOT NULL GROUP BY asset_id`, [tenantId])).rows, 'inventory');
    take((await this.db.query<{ asset_id: string; at: unknown }>(
      `SELECT asset_id, MAX(created_at) AS at FROM asset_movements
       WHERE tenant_id = $1 AND status <> 'rejected' GROUP BY asset_id`, [tenantId])).rows, 'movement');
    return out;
  }

  private async movementRows(tenantId: string, names: Names, lang: DqLang, now: Date, days: number): Promise<Row[]> {
    const since = new Date(now.getTime() - days * 24 * 3600 * 1000).toISOString();
    const { rows } = await this.db.query<DqMovement & { created_at: string | Date }>(
      `SELECT id, asset_id, movement_type, from_location_id, to_location_id, from_employee_id, to_employee_id,
              from_status_id, to_status_id, performed_by, created_at, status
       FROM asset_movements WHERE tenant_id = $1 AND status <> 'rejected' AND created_at >= $2::timestamptz
       ORDER BY created_at`,
      [tenantId, since],
    );
    const findings = findSuspiciousMovements(rows.map((r) => ({ ...r, created_at: ts(r.created_at) ?? '' })));
    if (findings.length === 0) return [];
    const { rows: assetRows } = await this.db.query<{ id: string; name: string; base_asset_code: string }>(
      `SELECT id, name, base_asset_code FROM assets WHERE tenant_id = $1`, [tenantId]);
    const assetById = new Map(assetRows.map((a) => [a.id, a]));
    return findings.map((f) => {
      const m = f.item;
      const asset = assetById.get(m.asset_id);
      return {
        ...(f.group_no !== undefined ? { group_no: f.group_no } : {}),
        issue: issuesText(f.issues, lang),
        asset_code: asset?.base_asset_code ?? '',
        asset_name: asset?.name ?? '',
        movement_type: m.movement_type,
        from_location_name: nameOf(names.locations, m.from_location_id),
        to_location_name: nameOf(names.locations, m.to_location_id),
        performed_by_name: nameOf(names.users, m.performed_by),
        created_at: isoDate(m.created_at, true),
      };
    });
  }
}

const SEEN_SOURCE_TEXT: Record<'inventory' | 'movement' | 'created', Record<DqLang, string>> = {
  inventory: { ar: 'جرد', en: 'Inventory' },
  movement: { ar: 'حركة', en: 'Movement' },
  created: { ar: 'تاريخ الإدخال فقط', en: 'Entry date only' },
};
