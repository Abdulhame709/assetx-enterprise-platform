-- AssetX Enterprise Platform — index for the login lockout query
-- Migration ID: 014_audit_login_index
-- Purpose: the lockout check counts recent AUTH_LOGIN_FAILED rows per user on
--          every login; without this index it scans a fast-growing table.
-- Rollback: DROP INDEX idx_audit_events_user_action_created;

CREATE INDEX IF NOT EXISTS idx_audit_events_user_action_created
  ON audit_events (user_id, action_type, created_at DESC);
