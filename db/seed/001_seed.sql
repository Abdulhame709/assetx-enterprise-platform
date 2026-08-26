-- ============================================================================
-- AssetX — Seed Data
-- Migration: 001_seed
-- Reference: DDS · Data Dictionary · Roles (AAB §15) · Statuses (AAB §13.9)
-- NOTE: Requires a tenant_id context (set app.tenant_id before running) for
-- tenant-scoped seed rows. System-level seed (channels) is tenant-independent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Notification channels (system-level, not tenant-scoped)
-- ---------------------------------------------------------------------------
INSERT INTO notification_channels (name, config) VALUES
  ('push',    '{"provider": "fcm"}'),
  ('email',   '{"provider": "smtp"}'),
  ('whatsapp', '{"provider": "whatsapp-api"}')
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Notification templates (tenant-scoped) — set app.tenant_id first
-- ---------------------------------------------------------------------------
INSERT INTO notification_templates (tenant_id, name, subject, body) VALUES
  (current_tenant_id(), 'inventory_assigned',   'Inventory Campaign Assigned', 'You have been assigned to inventory campaign {{cycle}}.'),
  (current_tenant_id(), 'inventory_completed',  'Inventory Campaign Completed', 'Campaign {{cycle}} has been completed.'),
  (current_tenant_id(), 'sync_failure',         'Sync Failure', 'Device {{device}} has {{count}} failed sync records.'),
  (current_tenant_id(), 'asset_transferred',    'Asset Transferred', 'Asset {{asset_name}} has been transferred.'),
  (current_tenant_id(), 'approval_required',    'Approval Required', 'Action {{action}} requires your approval.'),
  (current_tenant_id(), 'asset_created',        'Asset Created', 'Asset {{asset_name}} has been created.'),
  (current_tenant_id(), 'asset_status_changed', 'Asset Status Changed', 'Asset {{asset_name}} status changed to {{status_name}}.'),
  (current_tenant_id(), 'compliance_warning',   'Compliance Warning', 'Compliance warning: {{check}} count {{count}}.')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. Default roles (tenant-scoped) — AAB §15
-- ---------------------------------------------------------------------------
INSERT INTO roles (tenant_id, name, description, role_type) VALUES
  (current_tenant_id(), 'Administrator',       'Full management (users, permissions, settings)', 'admin'),
  (current_tenant_id(), 'Asset Manager',       'Register/edit assets, track movement', 'manager'),
  (current_tenant_id(), 'Auditor',             'Review assets, reports, discrepancies', 'auditor'),
  (current_tenant_id(), 'Department Manager',  'Department assets, reports', 'manager'),
  (current_tenant_id(), 'Inventory Team',      'Field inventory via mobile', 'field'),
  (current_tenant_id(), 'Maintenance',         'Maintenance orders', 'maintenance'),
  (current_tenant_id(), 'Employee',            'View own assets only', 'employee')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Default asset statuses (tenant-scoped) — AAB §13.9
-- ---------------------------------------------------------------------------
INSERT INTO statuses (tenant_id, name, color) VALUES
  (current_tenant_id(), 'New',                 '#2ecc71'),
  (current_tenant_id(), 'Good',                '#27ae60'),
  (current_tenant_id(), 'Used',                '#f39c12'),
  (current_tenant_id(), 'Needs Maintenance',   '#e67e22'),
  (current_tenant_id(), 'Under Maintenance',   '#e74c3c'),
  (current_tenant_id(), 'Damaged',             '#c0392b'),
  (current_tenant_id(), 'Missing',             '#8e44ad'),
  (current_tenant_id(), 'Retired',             '#7f8c8d')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Default asset categories (tenant-scoped)
-- ---------------------------------------------------------------------------
INSERT INTO asset_categories (tenant_id, name, full_path, level_number) VALUES
  (current_tenant_id(), 'Furniture',  'Furniture',  0),
  (current_tenant_id(), 'IT Equipment','IT Equipment', 0),
  (current_tenant_id(), 'Vehicles',   'Vehicles',   0),
  (current_tenant_id(), 'Office Equipment', 'Office Equipment', 0)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. Default location root (tenant-scoped)
--    Sets the tenant root location with LTREE path.
-- ---------------------------------------------------------------------------
INSERT INTO locations (tenant_id, name, location_type, path, full_path, level_number)
SELECT id, 'Headquarters', 'building', 'hq', 'Headquarters', 0
FROM tenants WHERE id = current_tenant_id()
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. Default settings (tenant-scoped)
-- ---------------------------------------------------------------------------
INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES
  (current_tenant_id(), 'organization_name', 'AssetX Demo Org'),
  (current_tenant_id(), 'logo',              ''),
  (current_tenant_id(), 'auto_backup_enabled', 'false')
ON CONFLICT (tenant_id, setting_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- End of seed
-- ---------------------------------------------------------------------------
