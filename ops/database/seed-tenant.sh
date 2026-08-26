#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${TENANT_CODE:?TENANT_CODE is required}"
TENANT_NAME="${TENANT_NAME:-AssetX ${TENANT_CODE}}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ ! "$TENANT_CODE" =~ ^[a-z0-9][a-z0-9_-]{1,62}$ ]]; then
  echo "TENANT_CODE must use lowercase letters, numbers, underscores, or hyphens" >&2
  exit 2
fi

TENANT_ID="$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 \
  -v tenant_code="$TENANT_CODE" \
  -v tenant_name="$TENANT_NAME" <<'SQL'
WITH inserted AS (
  INSERT INTO tenants (id, tenant_code, name, status)
  VALUES (gen_random_uuid(), :'tenant_code', :'tenant_name', 'active')
  ON CONFLICT (tenant_code) DO NOTHING
  RETURNING id
)
SELECT id FROM inserted
UNION ALL
SELECT id FROM tenants WHERE tenant_code = :'tenant_code'
LIMIT 1;
SQL
)"

if [[ ! "$TENANT_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then
  echo "Unable to resolve tenant id for TENANT_CODE=$TENANT_CODE" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v tenant_id="$TENANT_ID" <<SQL
BEGIN;
SELECT set_config('app.tenant_id', :'tenant_id', true);
\\i $ROOT_DIR/db/seed/000_location_types.sql
\\i $ROOT_DIR/db/seed/001_seed.sql
\\i $ROOT_DIR/db/seed/002_permissions.sql
COMMIT;
SQL

echo "AssetX tenant seed completed: $TENANT_CODE ($TENANT_ID)"
