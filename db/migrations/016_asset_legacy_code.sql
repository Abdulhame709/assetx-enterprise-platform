-- AssetX Enterprise Platform — legacy asset code in its own column
-- Migration ID: 016_asset_legacy_code
-- Purpose: the old importer appended codes like "2025-0038-13@location" to the
--          asset name; the cleanup moves that old code here (not into notes) so
--          it never takes space in reports unless the column is chosen.
-- Rollback: ALTER TABLE assets DROP COLUMN legacy_code;

ALTER TABLE assets ADD COLUMN IF NOT EXISTS legacy_code text;
COMMENT ON COLUMN assets.legacy_code IS 'Code used by the previous system (display/report only, optional)';
