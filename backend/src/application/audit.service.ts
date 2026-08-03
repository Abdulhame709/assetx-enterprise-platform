/**
 * AuditService — application use cases for audit & compliance logging.
 * Responsibilities: validation, mapping, classification, and querying.
 * It delegates persistence to AuditRepository (no business logic there).
 * Reference: ADR-010 · FRS FR-AUD-* · Entity Spec §5.17
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { AuditPort } from '../core/ports/audit.port';
import { AuditEvent, AuditLogInput, AuditQuery } from '../core/entities/audit.entity';
import { AUDIT_EVENTS, AuditEventKey } from '../core/constants/audit-events';
import { AUDIT_PORT, DATABASE_PORT } from '../core/ports/tokens';

@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  /** Log an audit event (validates action is from the catalog). */
  async log(input: Omit<AuditLogInput, 'tenant_id'> & { tenant_id?: string }): Promise<AuditEvent> {
    if (!input.tenant_id) throw new Error('TENANT_REQUIRED');
    if (!input.action || !(input.action in AUDIT_EVENTS)) {
      throw new Error('INVALID_AUDIT_ACTION');
    }
    const tenantId = input.tenant_id;
    await this.db.setTenant(tenantId);
    return this.audit.create({ ...input, tenant_id: tenantId });
  }

  /** Query events with filters + pagination. */
  async query(q: AuditQuery): Promise<{ items: AuditEvent[]; total: number }> {
    await this.db.setTenant(q.tenant_id);
    return this.audit.search(q);
  }

  /** Security events — login failures, permission denied/changed. */
  async securityQuery(tenantId: string, page = 1, limit = 100): Promise<{ items: AuditEvent[]; total: number }> {
    await this.db.setTenant(tenantId);
    const securitySet = new Set<string>(AuditService.SECURITY_KEYS);
    const recent = await this.audit.search({ tenant_id: tenantId, page: 1, limit: 500 });
    const items = recent.items.filter((e) => securitySet.has(e.action_type));
    return { items: items.slice(0, limit), total: items.length };
  }

  /** Asset timeline — all events for a given asset, oldest first. */
  async assetTimeline(tenantId: string, assetId: string): Promise<AuditEvent[]> {
    await this.db.setTenant(tenantId);
    const events = await this.audit.findByEntity(tenantId, 'asset', assetId, { limit: 200 });
    // chronological (oldest first) for a timeline
    return events.slice().reverse();
  }

  /**
   * Classification helper — returns a user-friendly label for an event key.
   * Used by /audit/security to categorize security-relevant events.
   */
  static classify(key: string): 'auth' | 'permission' | 'asset' | 'movement' | 'inventory' | 'compliance' | 'api' | 'other' {
    if (key.startsWith('AUTH_')) return 'auth';
    if (key.startsWith('PERMISSION_')) return 'permission';
    if (key.startsWith('ASSET_')) return 'asset';
    if (key.startsWith('MOVEMENT_')) return 'movement';
    if (key.startsWith('INVENTORY_')) return 'inventory';
    if (key.startsWith('COMPLIANCE_')) return 'compliance';
    if (key === AUDIT_EVENTS.API_REQUEST) return 'api';
    return 'other';
  }

  /** Security-relevant event keys (for /audit/security). */
  static SECURITY_KEYS: AuditEventKey[] = [
    AUDIT_EVENTS.AUTH_LOGIN_FAILED,
    AUDIT_EVENTS.PERMISSION_DENIED,
    AUDIT_EVENTS.PERMISSION_CHANGED,
    AUDIT_EVENTS.PERMISSION_GRANTED,
  ];
}
