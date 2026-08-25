-- AssetX Enterprise Platform — configurable location-type catalog
-- Migration ID: 012_location_types_catalog
-- Purpose: replace the fixed location_type enum contract with a tenant-scoped
--          catalog while preserving existing codes and location data.

CREATE TABLE location_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  code       text NOT NULL,
  name_ar    text NOT NULL,
  name_en    text,
  icon_key   text NOT NULL DEFAULT 'map-pin',
  sort_order integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  is_system  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code),
  CHECK (char_length(code) BETWEEN 2 AND 64),
  CHECK (code ~ '^[a-z0-9][a-z0-9_-]*$'),
  CHECK (char_length(name_ar) BETWEEN 2 AND 120),
  CHECK (name_en IS NULL OR char_length(name_en) BETWEEN 2 AND 120),
  CHECK (char_length(icon_key) BETWEEN 2 AND 48)
);

CREATE TRIGGER trg_location_types_updated
  BEFORE UPDATE ON location_types FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Keep the existing values and column name so current API consumers and imports
-- remain compatible; the value is now validated against the tenant catalog.
ALTER TABLE locations ALTER COLUMN location_type DROP DEFAULT;
ALTER TABLE locations ALTER COLUMN location_type TYPE text USING location_type::text;
ALTER TABLE locations ALTER COLUMN location_type SET DEFAULT 'room';

INSERT INTO location_types (tenant_id, code, name_ar, name_en, icon_key, sort_order, is_system)
SELECT t.id, d.code, d.name_ar, d.name_en, d.icon_key, d.sort_order, true
FROM tenants t
CROSS JOIN (
  VALUES
    ('building',  'مبنى',       'Building',  'building', 10),
    ('room',      'غرفة',       'Room',      'room',     20),
    ('warehouse', 'مستودع',     'Warehouse', 'warehouse',30),
    ('workshop',  'ورشة',       'Workshop',  'workshop', 40),
    ('outdoor',   'موقع خارجي', 'Outdoor',   'outdoor',  50)
) AS d(code, name_ar, name_en, icon_key, sort_order)
ON CONFLICT (tenant_id, code) DO NOTHING;

ALTER TABLE locations
  ADD CONSTRAINT locations_location_type_catalog_fk
  FOREIGN KEY (tenant_id, location_type)
  REFERENCES location_types (tenant_id, code)
  ON UPDATE RESTRICT
  ON DELETE RESTRICT;

ALTER TABLE location_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON location_types
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_insert ON location_types
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_update ON location_types
  FOR UPDATE USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_delete ON location_types
  FOR DELETE USING (tenant_id = current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON location_types TO authenticated;

-- Add the new permission keys for existing tenants. The catalog remains
-- idempotent for bootstrap and future permission seeding.
INSERT INTO permissions (tenant_id, module_name, can_view, is_active)
SELECT t.id, p.key, true, true
FROM tenants t
CROSS JOIN (VALUES
  ('location_type.view'), ('location_type.create'),
  ('location_type.update'), ('location_type.delete'),
  ('settings.view'), ('settings.update')
) AS p(key)
WHERE NOT EXISTS (
  SELECT 1 FROM permissions x
  WHERE x.tenant_id = t.id AND x.module_name = p.key
);

INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, p.id
FROM roles r
JOIN permissions p
  ON p.tenant_id = r.tenant_id
 AND p.module_name IN (
   'location_type.view', 'location_type.create',
   'location_type.update', 'location_type.delete',
   'settings.view', 'settings.update'
 )
WHERE r.role_type = 'admin' OR r.name = 'Administrator'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Read-only location users must be able to resolve the type selector on /locations.
INSERT INTO role_permissions (tenant_id, role_id, permission_id)
SELECT r.tenant_id, r.id, view_permission.id
FROM roles r
JOIN permissions location_permission
  ON location_permission.tenant_id = r.tenant_id
 AND location_permission.module_name = 'location.view'
JOIN role_permissions existing_location_view
  ON existing_location_view.role_id = r.id
 AND existing_location_view.permission_id = location_permission.id
JOIN permissions view_permission
  ON view_permission.tenant_id = r.tenant_id
 AND view_permission.module_name = 'location_type.view'
ON CONFLICT (role_id, permission_id) DO NOTHING;
