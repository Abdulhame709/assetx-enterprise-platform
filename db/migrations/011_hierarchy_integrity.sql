-- ============================================================================
-- AssetX — hierarchy integrity for asset categories
-- Migration ID: 011_hierarchy_integrity
-- Keep category names unique among active siblings, not across a whole tenant.
-- ============================================================================

ALTER TABLE asset_categories
  DROP CONSTRAINT IF EXISTS asset_categories_tenant_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS asset_categories_tenant_parent_name_key
  ON asset_categories (
    tenant_id,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  )
  WHERE is_active = true;

-- ============================================================================
-- End of migration 011_hierarchy_integrity
-- ============================================================================
