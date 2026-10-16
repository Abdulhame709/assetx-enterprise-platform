/**
 * IntegrityCheckerService — data integrity monitoring (Phase 11, Task T2).
 * Computes a weighted 0-100 integrity score. Weights are defined once here
 * (Constants) so new checks can be added without redesigning the algorithm.
 * Reference: Business Spec §6 · Micro Design Review T2
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { IntegrityCheck, IntegrityResult, IntegrityStatus } from '../core/entities/integrity.entity';
import { DATABASE_PORT } from '../core/ports/tokens';
import { foldAssetName } from './asset-algorithms';

/**
 * Integrity scoring policy (Composite Score).
 *
 * The score is NOT a plain sum of independent problems; it reflects severity.
 * A single asset can lose points for BOTH its composite severity (orphan_asset)
 * AND each individual quality issue it has (missing owner/location/barcode/
 * category). This double-counting is intentional: it surfaces that one asset can
 * carry multiple distinct defects, weighted by how severe each is.
 *
 *   orphan_asset    = Severe composite issue (missing location OR status OR owner)
 *   missing_*       = Individual quality issues
 *   duplicate_asset = Data-quality issue (one asset name carrying >1 base code;
 *                     the rule is one name = one base code)
 *
 * This is an explicit design decision (approved in review); change it only via
 * an RFC/ADR — do not silently treat it as a sum of independent problems.
 */
export const INTEGRITY_WEIGHTS = {
  orphan_asset: 30,
  missing_barcode: 15,
  missing_category: 15,
  missing_location: 10,
  missing_owner: 10,
  duplicate_asset: 20,
} as const;

@Injectable()
export class IntegrityCheckerService {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async check(tenantId: string): Promise<IntegrityResult> {
    await this.db.setTenant(tenantId);
    const checks: IntegrityCheck[] = [];
    let score = 100;

    // 1. Orphan asset: active but missing any of location/status/owner
    const orphan = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets
       WHERE tenant_id=$1 AND is_active=true AND (location_id IS NULL OR status_id IS NULL OR employee_id IS NULL)`,
      [tenantId]);
    checks.push(this.build('orphan_asset', Number(orphan.rows[0]?.c ?? 0)));

    // 2. Missing barcode
    const noBarcode = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE tenant_id=$1 AND is_active=true AND (barcode IS NULL OR barcode='')`,
      [tenantId]);
    checks.push(this.build('missing_barcode', Number(noBarcode.rows[0]?.c ?? 0)));

    // 3. Missing category
    const noCategory = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE tenant_id=$1 AND is_active=true AND category_id IS NULL`,
      [tenantId]);
    checks.push(this.build('missing_category', Number(noCategory.rows[0]?.c ?? 0)));

    // 4. Missing location
    const noLocation = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE tenant_id=$1 AND is_active=true AND location_id IS NULL`,
      [tenantId]);
    checks.push(this.build('missing_location', Number(noLocation.rows[0]?.c ?? 0)));

    // 5. Missing owner
    const noOwner = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE tenant_id=$1 AND is_active=true AND employee_id IS NULL`,
      [tenantId]);
    checks.push(this.build('missing_owner', Number(noOwner.rows[0]?.c ?? 0)));

    // 6. Identity conflicts: one asset name must carry ONE base code. Records that
    //    share a name (spacing / hamza / ya / ta-marbuta ignored) but hold different
    //    base codes are counted, except the ones holding the oldest (canonical) code.
    //    Several records under the same code (different location/status/holder) are normal.
    const named = await this.db.query<{ name: string; base_asset_code: string }>(
      `SELECT name, base_asset_code FROM assets
       WHERE tenant_id=$1 AND is_active=true AND base_asset_code IS NOT NULL`,
      [tenantId]);
    const codesByName = new Map<string, Map<string, number>>();
    for (const row of named.rows) {
      const key = foldAssetName(row.name);
      if (!key) continue;
      const codes = codesByName.get(key) ?? new Map<string, number>();
      codes.set(row.base_asset_code, (codes.get(row.base_asset_code) ?? 0) + 1);
      codesByName.set(key, codes);
    }
    let conflicting = 0;
    for (const codes of codesByName.values()) {
      if (codes.size < 2) continue;
      const canonical = [...codes.keys()].sort()[0];
      for (const [code, n] of codes) if (code !== canonical) conflicting += n;
    }
    checks.push(this.build('duplicate_asset', conflicting));

    // Deduct weighted score per affected unit, floor at 0
    for (const c of checks) {
      if (c.status === 'WARNING' && c.count > 0) {
        score -= c.weight * c.count;
      }
    }
    score = Math.max(0, score);

    const overall: IntegrityStatus = checks.some((c) => c.status === 'WARNING') ? 'WARNING' : 'OK';
    return { tenant_id: tenantId, score, checks, overall };
  }

  private build(check: keyof typeof INTEGRITY_WEIGHTS, count: number): IntegrityCheck {
    return {
      check,
      status: count > 0 ? 'WARNING' : 'OK',
      count,
      weight: count > 0 ? INTEGRITY_WEIGHTS[check] : 0,
    };
  }
}
