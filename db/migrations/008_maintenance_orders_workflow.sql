-- ============================================================================
-- Migration 008: Operational maintenance-order workflow
-- Reference: AssetX README §11A, §13.1 BR-MNT-002, legacy tblMaintenance.
-- ============================================================================

ALTER TABLE maintenance_orders
  ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS previous_status_id uuid REFERENCES statuses(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_orders_workflow_status_check'
  ) THEN
    ALTER TABLE maintenance_orders
      ADD CONSTRAINT maintenance_orders_workflow_status_check
      CHECK (workflow_status IN ('open', 'in_progress', 'completed', 'cancelled'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_maintenance_code_per_tenant
  ON maintenance_orders(tenant_id, maintenance_code)
  WHERE maintenance_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_workflow
  ON maintenance_orders(tenant_id, workflow_status, created_at DESC);

-- Every tenant needs a concrete asset status for BR-MNT-002. This is idempotent
-- and preserves a tenant's existing Maintenance status and color if present.
INSERT INTO statuses (tenant_id, name, color)
SELECT id, 'Maintenance', '#e67e22' FROM tenants
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Maintenance permissions are seeded both for newly initialized and existing
-- tenants so rolling out this migration does not leave the endpoints unreachable.
INSERT INTO permissions (tenant_id, module_name, can_view, is_active)
SELECT t.id, p.module_name, true, true
FROM tenants t
CROSS JOIN (VALUES ('maintenance.view'), ('maintenance.create'), ('maintenance.manage')) AS p(module_name)
WHERE NOT EXISTS (
  SELECT 1 FROM permissions existing
  WHERE existing.tenant_id = t.id AND existing.module_name = p.module_name
);

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
JOIN permissions p
  ON p.tenant_id = r.tenant_id
 AND p.module_name IN ('maintenance.view', 'maintenance.create', 'maintenance.manage')
WHERE r.name IN ('Administrator', 'Asset Manager', 'Maintenance')
  AND (
    p.module_name = 'maintenance.view'
    OR r.name IN ('Administrator', 'Asset Manager', 'Maintenance')
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
