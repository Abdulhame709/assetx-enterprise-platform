-- Run once with a PostgreSQL administrator, outside the application migration job.
-- This file intentionally contains no password or connection secret.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

-- The runtime connection role must be provisioned by the platform owner.
-- Grant it only the application privileges required by migration 007, or use
-- the managed provider's equivalent authenticated role mapping.
