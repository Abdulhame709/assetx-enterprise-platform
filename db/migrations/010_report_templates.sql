-- ============================================================================
-- AssetX — Persisted report-definition templates
-- Migration ID: 010_report_templates
-- Stores ERP report designer definitions for private and tenant-shared reuse.
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  created_by  uuid NOT NULL REFERENCES users(id),
  name        text NOT NULL,
  description text,
  resource    text NOT NULL CHECK (resource IN ('assets', 'movements', 'inventory', 'audit', 'dashboard')),
  format      text NOT NULL CHECK (format IN ('csv', 'xlsx', 'pdf')),
  definition  jsonb NOT NULL,
  is_shared   boolean NOT NULL DEFAULT false,
  version     int NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_templates_unique_owner_name UNIQUE (tenant_id, created_by, name)
);

CREATE INDEX IF NOT EXISTS idx_report_templates_tenant ON report_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_visibility ON report_templates(tenant_id, is_shared, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_templates_owner ON report_templates(tenant_id, created_by, updated_at DESC);

DROP TRIGGER IF EXISTS report_templates_set_updated_at ON report_templates;
CREATE TRIGGER report_templates_set_updated_at
  BEFORE UPDATE ON report_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_templates_select ON report_templates
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY report_templates_insert ON report_templates
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY report_templates_update ON report_templates
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY report_templates_delete ON report_templates
  FOR DELETE USING (tenant_id = current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON report_templates TO authenticated;

-- ============================================================================
-- End of migration 010_report_templates
-- ============================================================================
