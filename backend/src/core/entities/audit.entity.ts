/**
 * Audit entity — append-only audit/activity record (BC-AUDIT).
 * Reference: Data Dictionary (DOC-24) TB-AUDIT · Entity Spec §5.17
 * Reuses the existing audit_events table — no schema change.
 */

export interface AuditEvent {
  id: string;
  tenant_id: string;
  user_id: string | null;
  /** event action key from the audit-events catalog (e.g. ASSET_CREATED) */
  action_type: string;
  /** entity/table name (e.g. asset, movement, inventory, user, permission) */
  table_name: string;
  /** entity record id */
  record_id: string;
  /** event metadata (entityId, entity, reason, result, etc.) */
  details: Record<string, unknown> | null;
  ip_address: string | null;
  device_fingerprint: string | null;
  geo: string | null;
  user_agent: string | null;
  created_at: Date;
}

/** Input for logging an audit event via AuditService.log(). */
export interface AuditLogInput {
  tenant_id: string;
  userId: string | null;
  /** action key from the audit-events catalog */
  action: string;
  /** entity/table name (asset, movement, inventory, user, permission, auth) */
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  deviceFingerprint?: string | null;
  userAgent?: string | null;
}

/** Query filters for AuditRepository.find/search. */
export interface AuditQuery {
  tenant_id: string;
  action?: string;
  entity?: string;
  userId?: string;
  recordId?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  page?: number;
  limit?: number;
}
