/**
 * SavedSearchService — application use cases for saved searches (ADR-011).
 * Validation, per-user limits (50), ownership, audit, and re-execution.
 * Reference: Advanced-Search-Design-Specification §10 · ADR-011 §3/§5
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { SavedSearchPort } from '../core/ports/saved-search.port';
import { SavedSearch, SavedSearchResource } from '../core/entities/saved-search.entity';
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { DATABASE_PORT, SAVED_SEARCH_PORT } from '../core/ports/tokens';

const MAX_PER_USER = 50;
const MAX_PAYLOAD_BYTES = 4096;
const MAX_NAME_LENGTH = 80;
const RESOURCES: SavedSearchResource[] = ['assets', 'movements', 'audit'];

@Injectable()
export class SavedSearchService {
  constructor(
    @Inject(SAVED_SEARCH_PORT) private readonly saved: SavedSearchPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, userId: string, input: {
    name: string;
    resource: SavedSearchResource;
    filters?: Record<string, unknown>;
    is_default?: boolean;
  }): Promise<SavedSearch> {
    await this.db.setTenant(tenantId);
    const name = (input.name ?? '').trim();
    if (!name || name.length > MAX_NAME_LENGTH) throw new Error('INVALID_SAVED_SEARCH_NAME');
    if (!RESOURCES.includes(input.resource)) throw new Error('INVALID_SAVED_SEARCH_RESOURCE');
    if (this.payloadSize(input.filters) > MAX_PAYLOAD_BYTES) throw new Error('SAVED_SEARCH_PAYLOAD_TOO_LARGE');
    if (await this.saved.existsName(tenantId, userId, name)) throw new Error('SAVED_SEARCH_NAME_EXISTS');
    const count = await this.saved.countByUser(tenantId, userId);
    if (count >= MAX_PER_USER) throw new Error('SAVED_SEARCH_LIMIT_EXCEEDED');

    const created = await this.saved.create({
      tenant_id: tenantId, userId, name,
      resource: input.resource,
      filters: input.filters ?? {},
      is_default: input.is_default,
    });
    await this.audit.log({
      tenant_id: tenantId, userId,
      action: AUDIT_EVENTS.SAVED_SEARCH_CREATED, entity: 'saved_search', entityId: created.id,
      metadata: { name, resource: input.resource },
    }).catch(() => undefined);
    return created;
  }

  async list(tenantId: string, userId: string): Promise<SavedSearch[]> {
    await this.db.setTenant(tenantId);
    return this.saved.list(tenantId, userId);
  }

  async update(tenantId: string, userId: string, id: string, patch: {
    name?: string;
    filters?: Record<string, unknown>;
    is_default?: boolean;
  }): Promise<SavedSearch | null> {
    await this.db.setTenant(tenantId);
    const existing = await this.saved.findById(id, tenantId, userId);
    if (!existing) throw new Error('SAVED_SEARCH_NOT_FOUND');
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name || name.length > MAX_NAME_LENGTH) throw new Error('INVALID_SAVED_SEARCH_NAME');
      if (await this.saved.existsName(tenantId, userId, name, id)) throw new Error('SAVED_SEARCH_NAME_EXISTS');
      patch.name = name;
    }
    if (patch.filters && this.payloadSize(patch.filters) > MAX_PAYLOAD_BYTES) throw new Error('SAVED_SEARCH_PAYLOAD_TOO_LARGE');
    const updated = await this.saved.update(id, tenantId, userId, patch);
    if (!updated) throw new Error('SAVED_SEARCH_NOT_FOUND');
    await this.audit.log({
      tenant_id: tenantId, userId,
      action: AUDIT_EVENTS.SAVED_SEARCH_UPDATED, entity: 'saved_search', entityId: id,
      metadata: { fields: Object.keys(patch) },
    }).catch(() => undefined);
    return updated;
  }

  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    await this.db.setTenant(tenantId);
    const existing = await this.saved.findById(id, tenantId, userId);
    if (!existing) throw new Error('SAVED_SEARCH_NOT_FOUND');
    await this.saved.remove(id, tenantId, userId);
    await this.audit.log({
      tenant_id: tenantId, userId,
      action: AUDIT_EVENTS.SAVED_SEARCH_DELETED, entity: 'saved_search', entityId: id,
      metadata: { name: existing.name },
    }).catch(() => undefined);
  }

  /** Re-run a saved search against live data (audited as executed). */
  async getForExecution(tenantId: string, userId: string, id: string): Promise<{ resource: SavedSearchResource; filters: Record<string, unknown> } | null> {
    await this.db.setTenant(tenantId);
    const existing = await this.saved.findById(id, tenantId, userId);
    if (!existing) return null;
    await this.audit.log({
      tenant_id: tenantId, userId,
      action: AUDIT_EVENTS.SAVED_SEARCH_EXECUTED, entity: 'saved_search', entityId: id,
      metadata: { resource: existing.resource, name: existing.name },
    }).catch(() => undefined);
    return { resource: existing.resource, filters: existing.filters };
  }

  private payloadSize(filters?: Record<string, unknown>): number {
    if (!filters) return 0;
    return Buffer.byteLength(JSON.stringify(filters), 'utf8');
  }
}
