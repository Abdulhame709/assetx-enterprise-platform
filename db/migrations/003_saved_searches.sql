-- ============================================================================
-- AssetX — Saved Searches
-- Migration ID: 003_saved_searches
-- ADR: ADR-011 (PROPOSED — awaiting approval; do not apply until approved)
-- Adds ONE new table for per-user saved searches (OD-2 Option B).
-- No changes to existing tables. Additive, forward-only.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. saved_searches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_searches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  user_id     uuid NOT NULL REFERENCES users(id),
  name        text NOT NULL,
  resource    text NOT NULL,                 -- assets | movements | audit
  filters     jsonb NOT NULL,                -- persisted SearchQuery filters
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_searches_unique_name UNIQUE (tenant_id, user_id, name)
);

CREATE INDEX idx_saved_searches_tenant_user ON saved_searches(tenant_id, user_id);
CREATE INDEX idx_saved_searches_resource ON saved_searches(resource);

-- ---------------------------------------------------------------------------
-- 2. Row-Level Security (tenant isolation — ADR-004 pattern)
-- ---------------------------------------------------------------------------
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY saved_searches_select ON saved_searches
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY saved_searches_insert ON saved_searches
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY saved_searches_update ON saved_searches
  FOR UPDATE USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY saved_searches_delete ON saved_searches
  FOR DELETE USING (tenant_id = current_tenant_id());

-- Grant to the app role (same as other business tables)
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_searches TO authenticated;

-- ============================================================================
-- End of migration 003_saved_searches
-- ============================================================================
