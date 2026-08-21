-- AssetX — Inventory discrepancy movement extension
-- Migration ID: 003_inventory_missing_movement
-- A missing result is a reviewable movement request, not an automatic disposal.
-- Approval of this movement type records the decision without deactivating the asset.

ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'missing';
