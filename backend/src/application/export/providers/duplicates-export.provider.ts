/**
 * DuplicatesExportProvider — finds assets that look like the same thing entered
 * twice: same serial number, same barcode, or same name + type + location.
 * Each asset appears in at most one group (serial first, then barcode, then name).
 * Optional filter: category_id.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../../core/ports/database.port';
import { ExportOptions } from '../../../core/entities/export.entity';
import { ExportProvider } from '../../../core/ports/export-provider.port';
import { DATABASE_PORT } from '../../../core/ports/tokens';
import { loadNameMaps, nameOf, statusName } from '../export-lookups';

interface AssetRow {
  id: string;
  name: string;
  full_asset_code: string;
  serial_number: string | null;
  barcode: string | null;
  category_id: string | null;
  location_id: string | null;
  employee_id: string | null;
  status_id: string | null;
  purchase_price: string | number;
}

const REASONS = {
  serial: { ar: 'نفس الرقم التسلسلي', en: 'Same serial number' },
  barcode: { ar: 'نفس الباركود', en: 'Same barcode' },
  name: { ar: 'نفس الاسم والنوع والموقع', en: 'Same name, type and location' },
} as const;

/** Lower-case, strip Arabic diacritics/tatweel, unify letter variants, collapse spaces. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable()
export class DuplicatesExportProvider implements ExportProvider {
  readonly resource = 'duplicates';

  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async getData(tenantId: string, options?: ExportOptions): Promise<{ rows: unknown[]; total: number }> {
    // The on-screen preview has no audit write before it (which binds the tenant), so bind it here.
    await this.db.setTenant(tenantId);
    const filters = (options?.filters ?? {}) as Record<string, unknown>;
    const lang = options?.meta?.lang === 'en' ? 'en' : 'ar';
    const names = await loadNameMaps(this.db, tenantId);
    const params: unknown[] = [tenantId];
    let extra = '';
    if (typeof filters.category_id === 'string' && filters.category_id) {
      params.push(filters.category_id);
      extra = ` AND category_id = $${params.length}`;
    }
    const { rows: assets } = await this.db.query<AssetRow>(
      `SELECT id, name, full_asset_code, serial_number, barcode, category_id, location_id, employee_id, status_id, purchase_price
       FROM assets WHERE tenant_id = $1 AND is_active = true${extra} ORDER BY name, full_asset_code`,
      params,
    );

    const taken = new Set<string>();
    const out: Record<string, unknown>[] = [];
    let groupNo = 0;
    const rules: Array<{ reason: keyof typeof REASONS; key: (a: AssetRow) => string }> = [
      { reason: 'serial', key: (a) => normalizeText(a.serial_number) },
      { reason: 'barcode', key: (a) => normalizeText(a.barcode) },
      {
        reason: 'name',
        key: (a) => (normalizeText(a.name) ? `${normalizeText(a.name)}|${a.category_id ?? ''}|${a.location_id ?? ''}` : ''),
      },
    ];
    for (const rule of rules) {
      const buckets = new Map<string, AssetRow[]>();
      for (const a of assets) {
        if (taken.has(a.id)) continue;
        const key = rule.key(a);
        if (!key) continue;
        const list = buckets.get(key);
        if (list) list.push(a);
        else buckets.set(key, [a]);
      }
      for (const group of buckets.values()) {
        if (group.length < 2) continue;
        groupNo += 1;
        for (const a of group) {
          taken.add(a.id);
          out.push({
            group_no: groupNo,
            reason: REASONS[rule.reason][lang],
            full_asset_code: a.full_asset_code,
            name: a.name,
            serial_number: a.serial_number ?? '',
            barcode: a.barcode ?? '',
            category_name: nameOf(names.categories, a.category_id),
            location_name: nameOf(names.locations, a.location_id),
            employee_name: nameOf(names.employees, a.employee_id),
            status_name: statusName(names.statuses, a.status_id, lang),
            purchase_price: Number(a.purchase_price ?? 0),
          });
        }
      }
    }
    return { rows: out, total: out.length };
  }
}
