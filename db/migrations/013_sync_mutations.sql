-- AssetX Enterprise Platform — idempotent offline synchronization
-- Migration ID: 013_sync_mutations
-- Purpose: remember every offline mutation that was applied, so a retry after a
--          lost response is answered with the original result instead of being
--          re-applied or reported as a false conflict (action plan SEC-09).
-- Rollback: DROP TABLE sync_mutations;  (nothing else depends on it)

CREATE TABLE sync_mutations (
  tenant_id   uuid        NOT NULL REFERENCES tenants(id),
  mutation_id text        NOT NULL,
  cycle_id    uuid        NOT NULL REFERENCES inventory_cycles(id),
  record_id   uuid        NOT NULL REFERENCES inventory_records(id),
  user_id     uuid        REFERENCES users(id),
  -- updated_at of the record right after this mutation was applied
  applied_updated_at timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, mutation_id),
  CHECK (char_length(mutation_id) BETWEEN 1 AND 128)
);

CREATE INDEX idx_sync_mutations_record ON sync_mutations (tenant_id, record_id);

ALTER TABLE sync_mutations ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_mutations_select ON sync_mutations
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY sync_mutations_insert ON sync_mutations
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

-- Applied mutations are an append-only log: no UPDATE / DELETE for the runtime role.
GRANT SELECT, INSERT ON sync_mutations TO authenticated;

-- ============================================================================
-- End of migration 013_sync_mutations
-- ============================================================================
