-- AssetX — Standard location-type catalog seed
-- Requires app.tenant_id to be set for the tenant being initialized.
-- Idempotent: safe to run again for the same tenant.
-- This runs after migration 012 creates location_types and before 001_seed.sql
-- creates the default Headquarters location.

DO $location_types$
BEGIN
  IF current_tenant_id() IS NULL THEN
    RAISE EXCEPTION 'app.tenant_id must be set before running 000_location_types.sql';
  END IF;
END
$location_types$;

INSERT INTO location_types (tenant_id, code, name_ar, name_en, icon_key, sort_order, is_system)
VALUES
  (current_tenant_id(), 'building',  'مبنى',       'Building',  'building',  10, true),
  (current_tenant_id(), 'room',      'غرفة',        'Room',      'room',      20, true),
  (current_tenant_id(), 'warehouse', 'مستودع',      'Warehouse', 'warehouse', 30, true),
  (current_tenant_id(), 'workshop',  'ورشة',        'Workshop',  'workshop',  40, true),
  (current_tenant_id(), 'outdoor',   'موقع خارجي',  'Outdoor',   'outdoor',   50, true)
ON CONFLICT (tenant_id, code) DO NOTHING;
