/**
 * ComplianceService — data integrity monitoring (Phase 10.7).
 * Checks: assets missing location/status/custodian, stale pending movements,
 * open inventory cycles, users without permissions.
 * Reference: ADR-010 · Data Governance (AAB §11W)
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { DATABASE_PORT, EVENT_BUS } from '../core/ports/tokens';
import { EventBus } from '../core/events/event-bus';
import { DOMAIN_EVENTS } from '../core/events/event-types';

export interface ComplianceCheck {
  check: string;
  status: 'OK' | 'WARNING';
  count: number;
  details?: string[];
}

@Injectable()
export class ComplianceService {
  // Movements pending longer than this many days are flagged.
  private static PENDING_DAYS = 7;

  constructor(
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  async health(tenantId: string): Promise<{ tenant_id: string; checks: ComplianceCheck[]; overall: 'OK' | 'WARNING' }> {
    await this.db.setTenant(tenantId);
    const checks: ComplianceCheck[] = [];

    // 1. Assets missing a location
    const noLoc = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE tenant_id=$1 AND is_active=true AND location_id IS NULL`, [tenantId]);
    checks.push(this.warn('assets_without_location', Number(noLoc.rows[0]?.c ?? 0)));

    // 2. Assets missing a status
    const noStatus = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE tenant_id=$1 AND is_active=true AND status_id IS NULL`, [tenantId]);
    checks.push(this.warn('assets_without_status', Number(noStatus.rows[0]?.c ?? 0)));

    // 3. Assets without a custodian/owner
    const noOwner = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE tenant_id=$1 AND is_active=true AND employee_id IS NULL`, [tenantId]);
    checks.push(this.warn('assets_without_owner', Number(noOwner.rows[0]?.c ?? 0)));

    // 4. Movements pending for more than N days
    const staleMovements = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM asset_movements
       WHERE tenant_id=$1 AND status='pending' AND created_at < now() - ($2::int * interval '1 day')`,
      [tenantId, ComplianceService.PENDING_DAYS]);
    checks.push(this.warn('stale_pending_movements', Number(staleMovements.rows[0]?.c ?? 0)));

    // 5. Open (non-closed) inventory cycles
    const openCycles = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM inventory_cycles WHERE tenant_id=$1 AND status <> 'closed'`, [tenantId]);
    checks.push(this.warn('open_inventory_cycles', Number(openCycles.rows[0]?.c ?? 0)));

    // 6. Users with no permissions
    const noPermUsers = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM users u
       WHERE u.tenant_id=$1 AND u.is_active=true
         AND NOT EXISTS (
           SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
           WHERE ur.user_id = u.id
         )`,
      [tenantId]);
    checks.push(this.warn('users_without_permissions', Number(noPermUsers.rows[0]?.c ?? 0)));

    // 7. Assets without a barcode (Phase 11 — Compliance Expansion)
    const noBarcode = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE tenant_id=$1 AND is_active=true AND (barcode IS NULL OR barcode = '')`, [tenantId]);
    checks.push(this.warn('assets_without_barcode', Number(noBarcode.rows[0]?.c ?? 0)));

    // 8. Assets without a category (Phase 11 — Compliance Expansion)
    const noCategory = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE tenant_id=$1 AND is_active=true AND category_id IS NULL`, [tenantId]);
    checks.push(this.warn('assets_without_category', Number(noCategory.rows[0]?.c ?? 0)));

    const overall = checks.some((c) => c.status === 'WARNING') ? 'WARNING' : 'OK';
    if (overall === 'WARNING') {
      await this.audit.log({
        tenant_id: tenantId, userId: null,
        action: AUDIT_EVENTS.COMPLIANCE_WARNING, entity: 'compliance', entityId: tenantId,
        metadata: { checks: checks.filter((c) => c.status === 'WARNING') },
      }).catch(() => undefined);
      // Notify: compliance warning (each failing check)
      for (const c of checks.filter((x) => x.status === 'WARNING')) {
        this.bus.publish({
          event: DOMAIN_EVENTS.COMPLIANCE_WARNING,
          tenant_id: tenantId,
          entityId: tenantId,
          payload: { check: c.check, count: String(c.count) },
        });
      }
    }
    return { tenant_id: tenantId, checks, overall };
  }

  private warn(check: string, count: number): ComplianceCheck {
    return { check, status: count > 0 ? 'WARNING' : 'OK', count };
  }
}
