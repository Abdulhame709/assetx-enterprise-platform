-- ============================================================================
-- AssetX — Asset Movement Lifecycle Extension
-- Migration ID: 002_movement_lifecycle
-- ADR: ADR-007 — Extend Asset Movement Lifecycle
-- Reason: existing asset_movements schema supports historical movements only.
--   Enterprise workflow requires an approval lifecycle and additional movement types.
-- Applies: enum extension + approval status columns + status constraint.
-- NOTE: No new tables. asset_movements remains the single movement entity.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extend movement_type enum to 6 values (scope decision, approved)
-- ---------------------------------------------------------------------------
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'assignment';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'return';
ALTER TYPE movement_type ADD VALUE IF NOT EXISTS 'maintenance_return';

-- ---------------------------------------------------------------------------
-- 2. Add approval lifecycle columns
--    status: pending | approved | rejected (default pending)
--    approved_at: timestamp of approval
-- ---------------------------------------------------------------------------
ALTER TABLE asset_movements
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 3. Constrain status values (avoid free-text)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'asset_movements_status_check'
  ) THEN
    ALTER TABLE asset_movements
      ADD CONSTRAINT asset_movements_status_check
      CHECK (status IN ('pending','approved','rejected'));
  END IF;
END;
$$;

-- ============================================================================
-- End of migration 002_movement_lifecycle
-- ============================================================================
