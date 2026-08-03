/**
 * AuditRepository port — abstract data access for audit events.
 * The repository only persists/retrieves; it has no business logic.
 * Reference: Data Dictionary TB-AUDIT · ADR-010
 */
import { AuditEvent, AuditLogInput, AuditQuery } from '../entities/audit.entity';

export interface AuditPort {
  create(input: AuditLogInput): Promise<AuditEvent>;
  find(query: AuditQuery): Promise<{ items: AuditEvent[]; total: number }>;
  findByEntity(tenantId: string, entity: string, entityId: string, query?: Partial<AuditQuery>): Promise<AuditEvent[]>;
  findByUser(tenantId: string, userId: string, query?: Partial<AuditQuery>): Promise<AuditEvent[]>;
  search(query: AuditQuery): Promise<{ items: AuditEvent[]; total: number }>;
}
