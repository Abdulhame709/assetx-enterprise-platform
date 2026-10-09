# AssetX Database

This directory contains the **executable, verified** AssetX database implementation.

## Structure

| Path | Description |
|---|---|
| `migrations/001_init.sql` | Full schema: 24 tables, 6 enums, PK/FK, indexes, constraints, RLS policies, triggers, computed inventory-result view |
| `seed/001_seed.sql` | Reference seed data: roles, statuses, channels, categories, templates, settings, location root |
| `seed/002_permissions.sql` | Idempotent permission catalog seed and role-to-permission links; requires `app.tenant_id` |
| `verification/verify.sql` | Verification queries (schema, RLS, FKs, uniques, seed, LTREE) |
| `spec/ERD.mmd` | Final entity-relationship diagram (Mermaid) |

## Verified Status

The schema was executed and validated against a live PostgreSQL engine (via `@electric-sql/pglite`, a WASM build of real PostgreSQL):

- ✅ 24 tables created
- ✅ 6 enum types (cycle_status, inventory_result, location_type, movement_type, notification_channel, tenant_status)
- ✅ 65 foreign key constraints
- ✅ 15 unique constraints
- ✅ 22 tables protected by Row-Level Security
- ✅ RLS isolation confirmed under a non-owner `authenticated` role (t1 sees its data; t2 sees none — no cross-tenant leakage)
- ✅ Computed inventory result view verified (expected 1 / actual 0 → `missing`)
- ✅ Seed data: 7 roles, 8 statuses, 3 channels, 4 categories, 5 templates, 3 settings, 1 location root

> **Note on RLS testing:** When connected as a superuser/table owner (e.g., `postgres`), PostgreSQL **bypasses RLS by design**. In production (Supabase), the API connects as a non-owner `authenticated`/`service_role` and RLS applies. The isolation test above uses the non-owner role to confirm this correctly.

## How to Run (Supabase / any PostgreSQL 13+)

```bash
# 1. Apply schema
psql "$DATABASE_URL" -f db/migrations/001_init.sql

# 2. Seed (requires app.tenant_id context set by the app; for a manual first tenant,
#    set the context before running tenant-scoped seed inserts)
psql "$DATABASE_URL" -f db/seed/001_seed.sql
psql "$DATABASE_URL" -f db/seed/002_permissions.sql
```

RLS relies on the session setting `app.tenant_id` being set by the API layer (resolved by `current_tenant_id()`). The same context must be set before running both seed files so tenant-scoped records and permission links are created for the intended tenant. Set it per request, e.g.:

```sql
SELECT set_config('app.tenant_id', '<tenant-uuid>', true);  -- transaction-local
```

## References

- DDS — `Database/Database_Design_Specification.md` (DOC-09)
- Data Dictionary — `Engineering-Specifications/04_Database_Data_Dictionary.md` (DOC-24)
- Entity Spec — `Engineering-Specifications/01_Entity_Specifications.md` (DOC-21)
- Security — `Security/Security_Architecture.md` (DOC-13)
