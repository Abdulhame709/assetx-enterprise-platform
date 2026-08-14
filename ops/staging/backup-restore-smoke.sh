#!/usr/bin/env bash
set -Eeuo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${ALLOW_DESTRUCTIVE_RESTORE:?Set ALLOW_DESTRUCTIVE_RESTORE=true only for a disposable restore target}"

if [[ "$ALLOW_DESTRUCTIVE_RESTORE" != "true" ]]; then
  echo "Refusing restore: set ALLOW_DESTRUCTIVE_RESTORE=true for a disposable target" >&2
  exit 2
fi

command -v pg_dump >/dev/null
command -v pg_restore >/dev/null
command -v psql >/dev/null

backup_file="${BACKUP_FILE:-$(mktemp /tmp/assetx-backup.XXXXXX.dump)}"
cleanup() { rm -f "$backup_file"; }
trap cleanup EXIT

pg_dump --format=custom --no-owner --file="$backup_file" "$DATABASE_URL"
pg_restore --clean --if-exists --no-owner --exit-on-error --dbname="$RESTORE_DATABASE_URL" "$backup_file"

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc \
  "SELECT CASE WHEN to_regclass('public.schema_migrations') IS NULL THEN 1 ELSE 0 END;" \
  | grep -qx '0'

psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atc \
  "SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname='authenticate_user') THEN 0 ELSE 1 END;" \
  | grep -qx '0'

echo "AssetX backup/restore smoke test passed"
