-- AssetX Enterprise Platform — persistent refresh sessions
-- Migration ID: 006_auth_sessions
-- Only token digests are persisted; raw JWT refresh tokens are never stored.

CREATE TABLE auth_sessions (
  id          uuid PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  replaced_by uuid REFERENCES auth_sessions(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_sessions_user
  ON auth_sessions(tenant_id, user_id, created_at DESC);

CREATE INDEX idx_auth_sessions_active_token
  ON auth_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON auth_sessions TO authenticated;
  END IF;
END
$$;
