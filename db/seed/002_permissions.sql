-- AssetX — Permission Catalog Seed
-- Requires app.tenant_id to be set for the tenant being initialized.
-- Idempotent: safe to run again after the base seed.

DO $permissions$
DECLARE
  tenant_uuid uuid := current_tenant_id();
  role_row record;
  role_uuid uuid;
  permission_key text;
  permission_uuid uuid;
BEGIN
  IF tenant_uuid IS NULL THEN
    RAISE EXCEPTION 'app.tenant_id must be set before running 002_permissions.sql';
  END IF;

  FOR role_row IN
    SELECT key AS role_name, value AS permission_values
    FROM jsonb_each($catalog$
    {
      "Administrator": [
        "asset.view", "asset.create", "asset.update", "asset.delete", "asset.transfer",
        "movement.view", "movement.create", "movement.approve", "movement.reject",
        "inventory.view", "inventory.create", "inventory.execute", "inventory.verify", "inventory.close",
        "dashboard.view",
        "export.assets", "export.movements", "export.inventory", "export.audit", "export.dashboard",
        "report.view", "report.export", "audit.export",
        "audit.view", "compliance.view",
        "admin.user", "admin.role",
        "notification.view", "notification.manage",
        "maintenance.view", "maintenance.create", "maintenance.manage",
        "search.global", "search.save",
        "location.view", "location.create", "location.update", "location.delete",
        "category.view", "category.create", "category.update", "category.delete",
        "model.view", "model.create", "model.update", "model.delete",
        "employee.view", "employee.create", "employee.update", "employee.delete",
        "status.view", "status.create", "status.update", "status.delete",
        "location_type.view", "location_type.create", "location_type.update", "location_type.delete",
        "settings.view", "settings.update"
      ],
      "Asset Manager": [
        "asset.view", "asset.create", "asset.update", "asset.delete", "asset.transfer",
        "movement.view", "movement.create", "movement.approve", "movement.reject",
        "inventory.view", "inventory.create", "inventory.execute", "inventory.close", "dashboard.view",
        "export.assets", "export.movements", "export.inventory", "export.dashboard",
        "notification.view", "search.global", "search.save",
        "maintenance.view", "maintenance.create", "maintenance.manage",
        "location.view", "location.create", "location.update", "location.delete",
        "category.view", "category.create", "category.update", "category.delete",
        "model.view", "model.create", "model.update", "model.delete",
        "employee.view", "employee.create", "employee.update", "employee.delete",
        "status.view", "status.create", "status.update", "status.delete",
        "location_type.view", "location_type.create", "location_type.update", "location_type.delete"
      ],
      "Auditor": [
        "asset.view", "movement.view", "inventory.view", "inventory.verify", "dashboard.view",
        "export.assets", "export.movements", "export.inventory", "export.audit", "export.dashboard",
        "report.view", "report.export", "audit.export", "audit.view", "compliance.view",
        "notification.view", "search.global", "search.save",
        "location.view", "category.view", "model.view", "employee.view", "status.view", "location_type.view"
      ],
      "Department Manager": [
        "asset.view", "movement.view", "inventory.view", "dashboard.view",
        "notification.view", "search.global", "search.save",
        "location.view", "category.view", "model.view", "employee.view", "status.view", "location_type.view"
      ],
      "Inventory Team": [
        "inventory.view", "inventory.execute", "asset.view", "location.view", "status.view", "notification.view", "location_type.view"
      ],
      "Maintenance": [
        "asset.view", "movement.view", "location.view", "status.view", "notification.view", "location_type.view",
        "maintenance.view", "maintenance.create", "maintenance.manage"
      ],
      "Employee": [
        "asset.view", "location.view", "status.view", "notification.view", "location_type.view"
      ]
    }
    $catalog$::jsonb)
  LOOP
    SELECT id INTO role_uuid
    FROM roles
    WHERE tenant_id = tenant_uuid AND name = role_row.role_name
    LIMIT 1;

    IF role_uuid IS NULL THEN
      CONTINUE;
    END IF;

    FOR permission_key IN
      SELECT jsonb_array_elements_text(role_row.permission_values)
    LOOP
      permission_uuid := NULL;
      SELECT id INTO permission_uuid
      FROM permissions
      WHERE tenant_id = tenant_uuid AND module_name = permission_key
      LIMIT 1;

      IF permission_uuid IS NULL THEN
        INSERT INTO permissions (tenant_id, module_name, can_view, is_active)
        VALUES (tenant_uuid, permission_key, true, true)
        RETURNING id INTO permission_uuid;
      END IF;

      INSERT INTO role_permissions (tenant_id, role_id, permission_id)
      VALUES (tenant_uuid, role_uuid, permission_uuid)
      ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
  END LOOP;
END
$permissions$;
