/**
 * AuditRepository — infrastructure implementation of AuditPort.
 * Persists/retrieves audit rows only — no business logic.
 * Reference: Data Dictionary TB-AUDIT · ADR-010 (reuses audit_events)
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { AuditEvent, AuditLogInput, AuditQuery } from '../../core/entities/audit.entity';
import { AuditPort } from '../../core/ports/audit.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class AuditRepository implements AuditPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: AuditLogInput): Promise<AuditEvent> {
    const { rows } = await this.db.query<AuditEvent>(
      `INSERT INTO audit_events
         (tenant_id, user_id, action_type, table_name, record_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
       RETURNING *`,
      [
        input.tenant_id,
        input.userId ?? null,
        input.action,
        input.entity,
        input.entityId ?? '',
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.ip ?? null,
        input.userAgent ?? null,
      ],
    );
    return rows[0];
  }

  async find(query: AuditQuery): Promise<{ items: AuditEvent[]; total: number }> {
    return this.search(query);
  }

  async findByEntity(tenantId: string, entity: string, entityId: string, query?: Partial<AuditQuery>): Promise<AuditEvent[]> {
    const { items } = await this.search({
      tenant_id: tenantId,
      entity,
      recordId: entityId,
      page: query?.page ?? 1,
      limit: query?.limit ?? 100,
    });
    return items;
  }

  async findByUser(tenantId: string, userId: string, query?: Partial<AuditQuery>): Promise<AuditEvent[]> {
    const { items } = await this.search({
      tenant_id: tenantId,
      userId,
      page: query?.page ?? 1,
      limit: query?.limit ?? 100,
    });
    return items;
  }

  async search(query: AuditQuery): Promise<{ items: AuditEvent[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const offset = (page - 1) * limit;
    const params: unknown[] = [query.tenant_id];
    let where = `tenant_id = $1`;
    let idx = 2;

    if (query.action) { where += ` AND action_type = $${idx}`; params.push(query.action); idx++; }
    if (query.entity) { where += ` AND table_name = $${idx}`; params.push(query.entity); idx++; }
    if (query.userId) { where += ` AND user_id = $${idx}::uuid`; params.push(query.userId); idx++; }
    if (query.recordId) { where += ` AND record_id = $${idx}`; params.push(query.recordId); idx++; }
    if (query.dateFrom) { where += ` AND created_at >= $${idx}::timestamptz`; params.push(query.dateFrom); idx++; }
    if (query.dateTo) { where += ` AND created_at <= $${idx}::timestamptz`; params.push(query.dateTo); idx++; }

    const { rows } = await this.db.query<AuditEvent>(
      `SELECT * FROM audit_events WHERE ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );
    const { rows: countRows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM audit_events WHERE ${where}`,
      params,
    );
    return { items: rows, total: Number(countRows[0]?.c ?? 0) };
  }
}
