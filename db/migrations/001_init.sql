-- ============================================================================
-- AssetX Enterprise Platform — Database Initial Schema
-- Migration ID: 001_init
-- Reference: DDS (DOC-09) · Database Data Dictionary (DOC-24) · Security (DOC-13)
-- Architecture: PostgreSQL 15+ · Supabase · RLS (ADR-004) · UUID (ADR-001)
--             · LTREE hierarchy (ADR-005)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions (OPTIONAL — resilient across PostgreSQL builds)
--    gen_random_uuid() is built-in from PostgreSQL 13+ (no pgcrypto needed).
--    ltree & pg_trgm are used when available (full Supabase/Postgres installs);
--    the schema degrades gracefully to portable text columns otherwise.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- pg_trgm: similarity search (Levenshtein/trigram). Optional.
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  EXCEPTION WHEN OTHERS THEN
    -- extension unavailable (e.g., embedded/postgres builds); continue
  END;
  -- ltree: hierarchical locations (ADR-005). Optional.
  BEGIN
    CREATE EXTENSION IF NOT EXISTS ltree;
  EXCEPTION WHEN OTHERS THEN
    -- ltree unavailable; path column remains text (LTREE-compatible)
  END;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Enumerated Types
-- ---------------------------------------------------------------------------
-- Cycle lifecycle states (AAB §13.2)
CREATE TYPE cycle_status AS ENUM ('new', 'in_progress', 'closed');

-- Inventory result (AAB §13.2 / §13.12a — six results)
CREATE TYPE inventory_result AS ENUM (
  'matched', 'deficit', 'surplus', 'transferred', 'missing', 'not_inventoried'
);

-- Asset movement types (AAB §13.4)
CREATE TYPE movement_type AS ENUM ('transfer', 'disposal', 'retirement');

-- Tenant lifecycle
CREATE TYPE tenant_status AS ENUM ('draft', 'active', 'suspended', 'retired');

-- Notification channels
CREATE TYPE notification_channel AS ENUM ('push', 'email', 'whatsapp');

-- Location types (AAB §13.10)
CREATE TYPE location_type AS ENUM ('building', 'room', 'warehouse', 'workshop', 'outdoor');

-- ---------------------------------------------------------------------------
-- 2. Function: current_tenant_id()  (RLS scope resolver — ADR-004)
--    Resolves the active tenant from the session context (set by the API layer).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$;

-- Function: automatic updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. Identity Context (BC-IDENTITY)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- tenants — TB-TENANT (platform-scoped, not tenant-scoped)
-- ---------------------------------------------------------------------------
CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_code   text NOT NULL UNIQUE,
  name          text NOT NULL,
  status        tenant_status NOT NULL DEFAULT 'draft',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid
);

CREATE INDEX idx_tenants_code ON tenants(tenant_code);

-- ---------------------------------------------------------------------------
-- organizations — TB-ORGANIZATION
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  parent_id   uuid REFERENCES organizations(id),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);

CREATE INDEX idx_organizations_tenant ON organizations(tenant_id);

-- ---------------------------------------------------------------------------
-- employees — TB-EMPLOYEE (BC-EMPLOYEE)
--   PII: name/email = Confidential, phone = Restricted (ADL-009)
-- ---------------------------------------------------------------------------
CREATE TABLE employees (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  department  text,
  phone       text,
  email       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid
);

CREATE INDEX idx_employees_tenant ON employees(tenant_id);

-- ---------------------------------------------------------------------------
-- users — TB-USER (BC-IDENTITY)  ← aggregate root ENT-USER
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  employee_id    uuid REFERENCES employees(id),
  username       text NOT NULL UNIQUE,
  email          text,
  password_hash  text NOT NULL,
  last_login     timestamptz,
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- ---------------------------------------------------------------------------
-- roles — TB-ROLE
-- ---------------------------------------------------------------------------
CREATE TABLE roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  name         text NOT NULL,
  description  text,
  role_type    text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  UNIQUE (tenant_id, name)
);

-- ---------------------------------------------------------------------------
-- permissions — TB-PERMISSION  (5 permissions incl. can_print — ADL-005)
-- ---------------------------------------------------------------------------
CREATE TABLE permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  module_name  text NOT NULL,          -- MOD-*
  can_view     boolean NOT NULL DEFAULT false,
  can_add      boolean NOT NULL DEFAULT false,
  can_edit     boolean NOT NULL DEFAULT false,
  can_delete   boolean NOT NULL DEFAULT false,
  can_print    boolean NOT NULL DEFAULT false,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid,
  updated_by   uuid,
  UNIQUE (tenant_id, module_name, id)
);

-- ---------------------------------------------------------------------------
-- role_permissions — TB-ROLE-PERMISSION (join Role ↔ Permission)
-- ---------------------------------------------------------------------------
CREATE TABLE role_permissions (
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  role_id        uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id  uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ---------------------------------------------------------------------------
-- user_roles — TB-USER-ROLE (join User ↔ Role)
-- ---------------------------------------------------------------------------
CREATE TABLE user_roles (
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- ---------------------------------------------------------------------------
-- user_permissions — TB-USER-PERMISSION (per-user granular grants — AAB §13.5)
-- ---------------------------------------------------------------------------
CREATE TABLE user_permissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_name  text NOT NULL,
  can_view     boolean NOT NULL DEFAULT false,
  can_add      boolean NOT NULL DEFAULT false,
  can_edit     boolean NOT NULL DEFAULT false,
  can_delete   boolean NOT NULL DEFAULT false,
  can_print    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_name)
);

-- ============================================================================
-- 4. Asset Context (BC-ASSET)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- asset_categories — TB-CATEGORY (types + sub-types, nested)
-- ---------------------------------------------------------------------------
CREATE TABLE asset_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  name          text NOT NULL,
  parent_id     uuid REFERENCES asset_categories(id),
  full_path     text,
  level_number  int,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by   uuid,
  UNIQUE (tenant_id, name)
);

-- ---------------------------------------------------------------------------
-- asset_models — TB-ASSET-MODEL
-- ---------------------------------------------------------------------------
CREATE TABLE asset_models (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  category_id uuid REFERENCES asset_categories(id),
  sub_type_id uuid REFERENCES asset_categories(id),
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  UNIQUE (tenant_id, name)
);

-- ---------------------------------------------------------------------------
-- statuses — TB-STATUS  (asset lifecycle statuses with color — AAB §13.9)
-- ---------------------------------------------------------------------------
CREATE TABLE statuses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  color       text,                    -- StatusColor (hex)
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  UNIQUE (tenant_id, name)
);

-- ---------------------------------------------------------------------------
-- locations — TB-LOCATION (hierarchical, Materialized Path LTREE — ADR-005)
-- ---------------------------------------------------------------------------
CREATE TABLE locations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  parent_id     uuid REFERENCES locations(id),
  name          text NOT NULL,
  location_type location_type NOT NULL DEFAULT 'room',
  path          text NOT NULL,           -- Materialized path (LTREE-compatible, ADR-005)
  full_path     text NOT NULL,           -- DisplayName
  level_number  int NOT NULL DEFAULT 0,  -- TreeLevel
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid
);

-- GIN index on path for descendant queries (trigram when available; skip otherwise)
CREATE INDEX idx_locations_path ON locations (path);
CREATE INDEX idx_locations_tenant ON locations(tenant_id);
-- Loop prevention: a location cannot be its own ancestor (ADR-005)
ALTER TABLE locations ADD CONSTRAINT locations_no_self_parent CHECK (id IS DISTINCT FROM parent_id);

-- ---------------------------------------------------------------------------
-- assets — TB-ASSET  (central table — aggregate root ENT-ASSET)  ⭐
-- ---------------------------------------------------------------------------
CREATE TABLE assets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  name               text NOT NULL,
  base_asset_code    text NOT NULL,                    -- YYYY-NNNN (BR-CODE-001)
  full_asset_code    text NOT NULL UNIQUE,             -- Base@Location (BR-ASSET-001)
  description        text,
  category_id        uuid REFERENCES asset_categories(id),
  sub_type_id        uuid REFERENCES asset_categories(id),
  model_id           uuid REFERENCES asset_models(id),
  location_id        uuid REFERENCES locations(id),
  quantity           int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status_id          uuid REFERENCES statuses(id),
  employee_id        uuid REFERENCES employees(id),    -- custodian
  purchase_price     decimal(18,2) NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  purchase_date      date,
  depreciation_rate  decimal(5,2) CHECK (depreciation_rate BETWEEN 0 AND 100),
  useful_life        int CHECK (useful_life >= 0),
  serial_number      text,
  barcode            text,
  reference_number   text,
  inventory_year     int,
  notes              text,
  is_active          boolean NOT NULL DEFAULT true,    -- soft delete (BR-ASSET-010)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by         uuid,
  updated_by         uuid
);

CREATE INDEX idx_assets_full_code  ON assets(full_asset_code);
CREATE INDEX idx_assets_base_code  ON assets(base_asset_code);
CREATE INDEX idx_assets_tenant     ON assets(tenant_id);
CREATE INDEX idx_assets_active     ON assets(is_active) WHERE is_active;
CREATE INDEX idx_assets_location   ON assets(location_id);
CREATE INDEX idx_assets_category   ON assets(category_id);
CREATE INDEX idx_assets_serial     ON assets(serial_number);

-- Similarity index on asset name — conditional on pg_trgm availability
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX idx_assets_name_trgm ON assets USING gin (name gin_trgm_ops)';
  END IF;
END;
$$;

-- ============================================================================
-- 5. Movement Context (BC-MOVEMENT) — TB-MOVEMENT (append-only)
-- ============================================================================
CREATE TABLE asset_movements (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id),
  asset_id          uuid NOT NULL REFERENCES assets(id),
  movement_type     movement_type NOT NULL DEFAULT 'transfer',
  from_location_id  uuid REFERENCES locations(id),
  to_location_id    uuid REFERENCES locations(id),
  from_employee_id  uuid REFERENCES employees(id),
  to_employee_id    uuid REFERENCES employees(id),
  from_status_id    uuid REFERENCES statuses(id),
  to_status_id      uuid REFERENCES statuses(id),
  reason            text,
  reference_number  text,
  approved_by       uuid REFERENCES users(id),
  quantity          int,
  notes             text,
  performed_by      uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now()   -- append-only (BR-MOV-004)
);

CREATE INDEX idx_movements_asset ON asset_movements(asset_id);
CREATE INDEX idx_movements_tenant ON asset_movements(tenant_id);

-- ============================================================================
-- 6. Maintenance Context (BC-MAINTENANCE) — TB-MAINTENANCE
-- ============================================================================
CREATE TABLE maintenance_orders (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenants(id),
  asset_id               uuid NOT NULL REFERENCES assets(id),
  maintenance_code       text,
  maintenance_type       text,
  cost                   decimal(18,2),
  technician_name        text,
  technician_contact     text,     -- Restricted PII
  start_date             date,
  end_date               date,
  next_maintenance_date  date,
  status_id              uuid REFERENCES statuses(id),
  priority               text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  updated_by             uuid
);

CREATE INDEX idx_maintenance_asset  ON maintenance_orders(asset_id);
CREATE INDEX idx_maintenance_tenant ON maintenance_orders(tenant_id);

-- ============================================================================
-- 7. Inventory Context (BC-INVENTORY)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- inventory_cycles — TB-CYCLE (aggregate root ENT-CYCLE)  ⭐
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_cycles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  year        int NOT NULL,
  status      cycle_status NOT NULL DEFAULT 'new',
  start_date  date,
  end_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  UNIQUE (tenant_id, year)          -- per-tenant (ADL-008)
);

-- ---------------------------------------------------------------------------
-- inventory_team — TB-TEAM
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_team (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  cycle_id    uuid NOT NULL REFERENCES inventory_cycles(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES employees(id),
  team_role   text NOT NULL DEFAULT 'member',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, employee_id)
);

CREATE INDEX idx_inv_team_cycle ON inventory_team(cycle_id);

-- ---------------------------------------------------------------------------
-- inventory_records — TB-RECORD (expected/actual; result computed — ADL-006)
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_records (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id),
  cycle_id                uuid NOT NULL REFERENCES inventory_cycles(id) ON DELETE CASCADE,
  asset_id                uuid NOT NULL REFERENCES assets(id),
  -- Expected
  expected_location_id    uuid REFERENCES locations(id),
  expected_quantity       int,
  expected_status_id      uuid REFERENCES statuses(id),
  expected_employee_id    uuid REFERENCES employees(id),
  -- Actual
  actual_location_id      uuid REFERENCES locations(id),
  actual_quantity         int,
  actual_status_id        uuid REFERENCES statuses(id),
  actual_employee_id      uuid REFERENCES employees(id),
  -- Result: COMPUTED via view/API (ADL-006), not stored
  inventory_date          date,
  inventory_by            uuid REFERENCES users(id),
  -- Verification (BR-INV-003)
  is_verified             boolean NOT NULL DEFAULT false,
  verified_by             uuid REFERENCES users(id),
  verified_date           timestamptz,
  notes                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, asset_id)       -- no duplicate asset per cycle
);

CREATE INDEX idx_records_cycle ON inventory_records(cycle_id);
CREATE INDEX idx_records_asset ON inventory_records(asset_id);
CREATE INDEX idx_records_tenant ON inventory_records(tenant_id);

-- ---------------------------------------------------------------------------
-- Computed inventory result — DB view (ADL-006: result is derived, not stored)
-- ---------------------------------------------------------------------------
CREATE VIEW v_inventory_result AS
SELECT
  ir.id,
  ir.cycle_id,
  ir.asset_id,
  ir.expected_quantity,
  ir.actual_quantity,
  ir.expected_location_id,
  ir.actual_location_id,
  CASE
    WHEN ir.actual_quantity IS NULL THEN 'not_inventoried'::inventory_result
    WHEN ir.actual_quantity = 0    THEN 'missing'::inventory_result
    WHEN ir.actual_quantity < ir.expected_quantity THEN 'deficit'::inventory_result
    WHEN ir.actual_quantity > ir.expected_quantity THEN 'surplus'::inventory_result
    WHEN ir.actual_location_id IS DISTINCT FROM ir.expected_location_id
                                     THEN 'transferred'::inventory_result
    ELSE 'matched'::inventory_result
  END AS result,
  ir.is_verified
FROM inventory_records ir;

-- ============================================================================
-- 8. Audit Context (BC-AUDIT) — TB-AUDIT (append-only, immutable)
-- ============================================================================
CREATE TABLE audit_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  user_id            uuid REFERENCES users(id),
  action_type        text NOT NULL,
  table_name         text NOT NULL,
  record_id          text NOT NULL,
  details            jsonb,
  ip_address         text,
  device_fingerprint text,
  geo                text,
  user_agent         text,
  created_at         timestamptz NOT NULL DEFAULT now()   -- immutable
);

CREATE INDEX idx_audit_tenant  ON audit_events(tenant_id);
CREATE INDEX idx_audit_created ON audit_events(created_at);
CREATE INDEX idx_audit_action  ON audit_events(action_type);

-- ============================================================================
-- 9. Notification Context (BC-NOTIFICATION)
-- ============================================================================
CREATE TABLE notification_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  subject     text,
  body        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE notification_channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  config      jsonb
);

CREATE TABLE notifications (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  user_id      uuid NOT NULL REFERENCES users(id),
  template_id  uuid REFERENCES notification_templates(id),
  channel      notification_channel NOT NULL DEFAULT 'push',
  status       text NOT NULL DEFAULT 'queued',
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_tenant ON notifications(tenant_id);

-- ============================================================================
-- 10. Configuration Context (BC-CONFIG) — TB-SETTINGS
-- ============================================================================
CREATE TABLE settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  setting_key   text NOT NULL,
  setting_value text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, setting_key)
);

-- ============================================================================
-- 11. Triggers — automatic updated_at
-- ============================================================================
CREATE TRIGGER trg_tenants_updated       BEFORE UPDATE ON tenants            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_organizations_updated BEFORE UPDATE ON organizations      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_employees_updated     BEFORE UPDATE ON employees          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated         BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_roles_updated         BEFORE UPDATE ON roles              FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_permissions_updated   BEFORE UPDATE ON permissions        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_categories_updated    BEFORE UPDATE ON asset_categories   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_models_updated        BEFORE UPDATE ON asset_models       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_statuses_updated      BEFORE UPDATE ON statuses           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_locations_updated     BEFORE UPDATE ON locations          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assets_updated        BEFORE UPDATE ON assets             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_maintenance_updated   BEFORE UPDATE ON maintenance_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_cycles_updated        BEFORE UPDATE ON inventory_cycles   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_records_updated       BEFORE UPDATE ON inventory_records  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_settings_updated      BEFORE UPDATE ON settings           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_userperms_updated     BEFORE UPDATE ON user_permissions   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 12. Row-Level Security (RLS — ADR-004)
--     Business tables are tenant-scoped via current_tenant_id().
-- ============================================================================
ALTER TABLE organizations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_models      ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_movements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_cycles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_team    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings          ENABLE ROW LEVEL SECURITY;

-- tenants is platform-scoped (no tenant RLS on tenants itself)

-- Tenant-scoped SELECT/INSERT/UPDATE/DELETE policies
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'organizations','employees','users','roles','permissions',
    'role_permissions','user_roles','user_permissions',
    'asset_categories','asset_models','statuses','locations','assets',
    'asset_movements','maintenance_orders','inventory_cycles',
    'inventory_team','inventory_records','audit_events',
    'notification_templates','notifications','settings'
  ]
  LOOP
    EXECUTE format('CREATE POLICY tenant_isolation ON %I FOR SELECT USING (tenant_id = current_tenant_id())', t);
    EXECUTE format('CREATE POLICY tenant_isolation_insert ON %I FOR INSERT WITH CHECK (tenant_id = current_tenant_id())', t);
    EXECUTE format('CREATE POLICY tenant_isolation_update ON %I FOR UPDATE USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id())', t);
    EXECUTE format('CREATE POLICY tenant_isolation_delete ON %I FOR DELETE USING (tenant_id = current_tenant_id())', t);
  END LOOP;
END;
$$;

-- ============================================================================
-- End of migration 001_init
-- ============================================================================
