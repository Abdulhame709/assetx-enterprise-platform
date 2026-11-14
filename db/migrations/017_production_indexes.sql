-- AssetX Enterprise Platform — composite indexes for list / filter / history queries
-- Migration ID: 017_production_indexes
-- Purpose: every list query is tenant-scoped and ordered (assets by name, movements and
--          audit events newest-first). The single-column indexes from 001 force Postgres to
--          fetch all of a tenant's rows and sort them; these composite indexes let it read
--          the right rows in order. All statements are idempotent (IF NOT EXISTS).
--
-- Operational note: the migration runner executes each file in one transaction, so
--          CREATE INDEX CONCURRENTLY cannot be used here. A plain CREATE INDEX blocks
--          writes to the table while it builds. On a large production table, build the
--          indexes by hand first with CONCURRENTLY (same names), then this file becomes a no-op:
--            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_tenant_status ON assets (tenant_id, status_id) WHERE is_active;
--
-- Rollback (safe, indexes only, no data is touched):
--   DROP INDEX IF EXISTS idx_assets_tenant_name;
--   DROP INDEX IF EXISTS idx_assets_tenant_status;
--   DROP INDEX IF EXISTS idx_assets_tenant_location;
--   DROP INDEX IF EXISTS idx_assets_tenant_category;
--   DROP INDEX IF EXISTS idx_assets_tenant_employee;
--   DROP INDEX IF EXISTS idx_movements_tenant_created;
--   DROP INDEX IF EXISTS idx_movements_asset_created;
--   DROP INDEX IF EXISTS idx_audit_events_tenant_created;
--   DROP INDEX IF EXISTS idx_audit_events_tenant_entity;
--   DROP INDEX IF EXISTS idx_notifications_tenant_user_created;

-- Assets: active rows only (queries always filter is_active = true).
CREATE INDEX IF NOT EXISTS idx_assets_tenant_name     ON assets (tenant_id, name) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_assets_tenant_status   ON assets (tenant_id, status_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_assets_tenant_location ON assets (tenant_id, location_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_assets_tenant_category ON assets (tenant_id, category_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_assets_tenant_employee ON assets (tenant_id, employee_id) WHERE is_active;

-- Movements: tenant-wide newest-first list, and per-asset history.
CREATE INDEX IF NOT EXISTS idx_movements_tenant_created ON asset_movements (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_asset_created  ON asset_movements (asset_id, created_at DESC);

-- Audit: newest-first listing per tenant, and per-entity history.
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_created ON audit_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_entity  ON audit_events (tenant_id, table_name, record_id, created_at DESC);

-- Notifications: a user's inbox, newest first.
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user_created ON notifications (tenant_id, user_id, created_at DESC);
