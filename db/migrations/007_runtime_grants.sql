-- AssetX Enterprise Platform — runtime grants
-- Migration ID: 007_runtime_grants
-- Keep DDL/migration credentials separate from the non-owner HTTP role.

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  tenants, organizations, employees, users, roles, permissions, role_permissions,
  user_roles, user_permissions, password_reset_tokens, auth_sessions,
  asset_categories, asset_models, statuses, locations, assets,
  asset_movements, maintenance_orders, inventory_cycles, inventory_team,
  inventory_records, audit_events, notification_templates, notifications,
  settings, saved_searches TO authenticated;
GRANT SELECT ON v_inventory_result TO authenticated;
GRANT EXECUTE ON FUNCTION authenticate_user(text) TO authenticated;
