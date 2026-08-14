-- AssetX Enterprise Platform — password reset token storage
-- Migration ID: 004_password_reset_tokens
-- Security: store only SHA-256 token digests; raw tokens are never persisted.

CREATE TABLE password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  used_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_tokens_user
  ON password_reset_tokens(tenant_id, user_id);

CREATE INDEX idx_password_reset_tokens_active
  ON password_reset_tokens(token_hash, expires_at)
  WHERE used_at IS NULL;

-- Only the backend's privileged auth workflow accesses this platform-scoped table.
-- It is intentionally not tenant-RLS scoped because password-reset requests begin
-- before a user session/tenant context exists; the token is high-entropy and hashed.
