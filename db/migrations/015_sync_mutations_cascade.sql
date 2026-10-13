-- AssetX Enterprise Platform — allow deleting an unfinished inventory cycle
-- Migration ID: 015_sync_mutations_cascade
-- Purpose: sync_mutations (013) pointed at inventory_cycles / inventory_records
--          without ON DELETE, so a cycle that had received offline syncs could
--          not be deleted. The log now disappears together with its cycle.
--          The runtime role stays append-only (no DELETE grant): cleanup happens
--          only through the foreign-key cascade when a cycle is deleted.
-- Rollback: re-create both constraints without "ON DELETE CASCADE".

ALTER TABLE sync_mutations DROP CONSTRAINT sync_mutations_cycle_id_fkey;
ALTER TABLE sync_mutations DROP CONSTRAINT sync_mutations_record_id_fkey;

ALTER TABLE sync_mutations
  ADD CONSTRAINT sync_mutations_cycle_id_fkey
  FOREIGN KEY (cycle_id) REFERENCES inventory_cycles(id) ON DELETE CASCADE;
ALTER TABLE sync_mutations
  ADD CONSTRAINT sync_mutations_record_id_fkey
  FOREIGN KEY (record_id) REFERENCES inventory_records(id) ON DELETE CASCADE;

-- ============================================================================
-- End of migration 015_sync_mutations_cascade
-- ============================================================================
