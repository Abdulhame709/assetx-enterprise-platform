-- AssetX Enterprise Platform — pre-session authentication lookup
-- Migration ID: 005_authenticate_user_function
-- The function returns only the fields required to verify credentials.

CREATE OR REPLACE FUNCTION authenticate_user(input_username text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  employee_id uuid,
  username text,
  email text,
  password_hash text,
  last_login timestamptz,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    u.id,
    u.tenant_id,
    u.employee_id,
    u.username,
    u.email,
    u.password_hash,
    u.last_login,
    u.is_active,
    u.created_at,
    u.updated_at
  FROM users AS u
  WHERE u.username = input_username
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION authenticate_user(text) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION authenticate_user(text) TO authenticated;
  END IF;
END
$$;
