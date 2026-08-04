# ADR-011 — Introduce `saved_searches` Table

**Status:** Proposed — awaiting approval (do not apply migration until approved)
**Date:** 2026-08-03
**Deciders:** Senior Enterprise Solution Architect, TPM, Product Owner
**Approved decision referenced:** OD-2 → Option B (Advanced Search Design Specification)

---

## Context

Advanced Search (Phase 11.4) includes **Saved Searches** — users persist a named set of search filters and re-run them later. Per the approved design decision **OD-2 → Option B**, these are stored in a **dedicated `saved_searches` table** rather than reusing the existing `settings` key-value table.

## Why a new table is required

1. **Structured, typed storage:** a saved search is not a scalar key-value pair; it is a structured record (name, resource, filters JSON, owner user, timestamps, possibly shared flag). A dedicated table models this cleanly with real columns and constraints.
2. **Per-user ownership & isolation:** saved searches must be private and user-scoped. A dedicated table supports `user_id` + `tenant_id` + RLS naturally, and per-user CRUD with clear indexing.
3. **Queryability & management:** listing, ordering, and managing a user's saved searches (e.g. default flag) is far cleaner on a real table than string-concatenated keys in `settings`.
4. **Search/audit on saved searches:** a dedicated table integrates with RLS and future management screens without parsing opaque `setting_value` strings.

## Why existing tables cannot be reused

- **`settings`** is a generic key-value store for platform/tenant configuration (org name, logo, backup flags). Modeling saved searches there would require encoding structured JSON into `setting_value`, defeating type safety, per-user isolation (settings are tenant-scoped, not user-scoped), indexing, and management. It also pollutes the config store with high-churn user data.
- **`notifications` / `notification_templates`** are for delivery, unrelated to persisted query filters.
- No other existing table models "a named, user-owned query definition."

## Database impact

- **One new table:** `saved_searches`.
- **Columns:**
  - `id UUID PK`
  - `tenant_id UUID NOT NULL REFERENCES tenants(id)`
  - `user_id UUID NOT NULL REFERENCES users(id)`
  - `name TEXT NOT NULL`
  - `resource TEXT NOT NULL`  (assets | movements | audit)
  - `filters JSONB NOT NULL`  (the persisted SearchQuery filters)
  - `is_default BOOLEAN NOT NULL DEFAULT false`
  - `created_at TIMESTAMPTZ DEFAULT now()`
  - `updated_at TIMESTAMPTZ DEFAULT now()`
- **Indexes:**
  - `(tenant_id, user_id)` for per-user listing
  - `UNIQUE (tenant_id, user_id, name)` to prevent duplicate names per user
- **RLS:** enabled; tenant isolation via `current_tenant_id()` (same pattern as other business tables).
- No change to existing tables; no columns added elsewhere.

## Migration impact

- New file `db/migrations/003_saved_searches.sql` (additive, forward-only).
- Non-breaking: existing tables/features untouched.
- The `authenticated` role must be granted SELECT/INSERT/UPDATE/DELETE on the new table (same as other business tables) and RLS enabled.
- App bootstrap (db-init) will apply it alongside 001/002 once approved.

## Rollback strategy

- **Forward migration** (003) is additive. Rollback = run the inverse:
  ```sql
  DROP TABLE IF EXISTS saved_searches;
  ```
- Since it is a brand-new table with no dependencies on it elsewhere, dropping it has **no impact** on existing data or features.
- Any seeded saved-search rows are user data; rollback would remove them (acceptable pre-production).

## Future extensibility

- The table can be extended without breaking consumers:
  - `is_shared` / `shared_with` for team-shared searches.
  - `sort` + `page_size` defaults per saved search.
  - `tags` for organization.
  - Additional resource types (global) without schema change (filters is JSONB).
  - Soft-delete (`is_active`) if needed for user-facing "trash".

## Verification

- New integration/E2E tests cover: create/list/update/delete saved searches, per-user isolation (user A cannot see user B's), tenant isolation, and RLS enforcement.

---

**Status: PROPOSED.** Applying `db/migrations/003_saved_searches.sql` requires explicit approval of this ADR. Until then, the rest of Advanced Search (query builder, providers, controllers, permissions, tests) proceeds on existing tables.
