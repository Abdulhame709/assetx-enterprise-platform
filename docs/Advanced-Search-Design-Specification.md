# Advanced Search Design Specification — AssetX

> **Project:** AssetX — Enterprise Asset Management System
> **Phase:** 11.4 — Advanced Search Engine
> **Status:** Draft — **awaiting approval before implementation**
> **Date:** 2026-08-03

---

## 1. Purpose & Scope

Enhance the platform's search from basic filters into an **advanced, unified search** across Assets, Movements, and Audit — with dynamic filters, sorting, pagination, full-text/trigram matching, and saved searches. It is a **read-only** layer; no schema change unless explicitly approved (index additions are proposals).

### Goals
- Consistent search contract across resources.
- Filter on all relevant fields (asset: barcode/serial/category/location/employee/status/purchase-date/value-range; movement: type/status/date/user; audit: action/entity/user/date).
- Sorting + cursor/offset pagination.
- Full-text (name/description) + trigram (fuzzy) matching where available.
- Global cross-resource search.
- Saved searches per user.
- Search permissions.

### Non-goals (deferred)
- NLP/AI search, vector embeddings (pgvector) — later AI phase.
- Distributed search index (Elasticsearch/OpenSearch) — noted in register.

---

## 2. Search Architecture

```
Controller (GET /search/{resource}?filters...)
        │
        ▼
SearchService (Application — builds query model, no SQL)
        │
        ├── SearchQueryBuilder (normalizes filters/sort/pagination)
        │
        ├── ResourceSearchProvider per resource
        │       └── knows its repository; translates query model → repository call
        │
        └── SavedSearchService (persist user's named searches)
```

**Layering:** `SearchController` (API) → `SearchService` (Application, orchestrates, permission check) → `ResourceSearchProvider` (Infrastructure boundary, one per resource) → repository (Infrastructure, SQL). Reuses existing repositories rather than duplicating data access. Mirrors the Phase 11.3 `ExportProvider` pattern for consistency.

---

## 3. Query Builder

A normalized query model decouples controllers from SQL:

```ts
interface SearchQuery {
  resource: 'assets' | 'movements' | 'audit';
  filters: Record<string, SearchFilterValue>; // field -> value/range/array
  search?: string;              // free-text across searchable fields
  sort?: { field: string; dir: 'asc' | 'desc' };
  page?: number;
  limit?: number;
}
type SearchFilterValue =
  | { type: 'eq'; value: unknown }
  | { type: 'in'; values: unknown[] }
  | { type: 'range'; from?: unknown; to?: unknown }   // dates, numeric
  | { type: 'contains'; value: string };               // trigram/ILIKE
```

**Responsibilities of `SearchQueryBuilder`:** validate fields per resource, coerce types (date/number/uuid), normalize sort field, clamp page/limit, produce a repository-safe `SearchCriteria` object. It is pure (no DB access) and unit-testable.

---

## 4. Dynamic Filters

Filters are driven by a **per-resource field registry** (field → comparator + type). Controllers accept generic `filters` and the registry decides how each is applied, so adding a filter does not require touching the controller.

| Resource | Filterable Fields |
|---|---|
| **Assets** | `q`, `barcode`, `serial_number`, `category_id`, `location_id` (incl. descendants), `employee_id`, `status_id`, `purchase_date` (range), `purchase_price` (range), `is_active` |
| **Movements** | `movement_type`, `status`, `created_at` (range), `performed_by` (user), `asset_id` |
| **Audit** | `action`, `entity`, `user_id`, `record_id`, `created_at` (range) |

All filters are **tenant-scoped** (RLS + `tenant_id`).

---

## 5. Sorting

- Per-resource allow-list of sortable fields (prevents SQL injection via arbitrary column names).
- Default sort per resource (assets: `name`; movements/audit: `created_at DESC`).
- Syntax: `?sort=field&dir=asc|desc` or `sort=field:asc`.

---

## 6. Pagination

- Support **offset/limit** (current) and optionally **cursor** for large result sets.
- Default `limit=20`, max `limit=100`.
- Return `{ items, total, page, limit, hasMore }`.
- **Recommendation (register):** move to cursor pagination when assets exceed ~50k.

---

## 7. Full-Text Search

- Use PostgreSQL **tsvector** (full-text) on `assets.name` + `assets.description` with a generated column OR expression index — **proposal requiring schema approval**.
- Fallback: `ILIKE '%term%'` (current behavior) for MVP without schema change.

---

## 8. Trigram Search

- PostgreSQL `pg_trgm` `gin_trgm_ops` index enables fuzzy matching on `name`/`serial_number`/`barcode`.
- `pg_trgm` extension is already attempted in migration 001 (optional).
- `similarity()`/`%` operator for "did you mean" matching.
- **Index proposal requiring approval**; MVP falls back to `ILIKE`.

---

## 9. Global Search

- `GET /search/global?q=...` — searches across assets (name/code/serial/barcode), movements (reason/reference), and audit (action) in one call; returns grouped results.
- Implemented as parallel queries through the resource providers; no new table.
- Permission: `search.global`.

---

## 10. Saved Searches

- Persist user's named search criteria (reuse `settings` key-value OR a new table — **decision required**; default: reuse `settings` to avoid a new table).
- CRUD: `GET /search/saved`, `POST /search/saved`, `PATCH /search/saved/:id`, `DELETE /search/saved/:id`.
- Permission: `search.save`.

---

## 11. Search Permissions

| Permission | Scope |
|---|---|
| `asset.view` | search assets |
| `movement.view` | search movements |
| `audit.view` | search audit |
| `search.global` | cross-resource global search |
| `search.save` | save/manage saved searches |

Routed through `@RequirePermission` + `PermissionGuard`. Saved searches are **per-user** (user_id-scoped), not cross-user.

---

## 12. Search Indexes (Proposals — need approval)

| Index | Purpose | Status |
|---|---|---|
| `GIN (name gin_trgm_ops)` on assets | fuzzy name search | Proposal |
| `GIN (serial_number gin_trgm_ops)` on assets | fuzzy serial | Proposal |
| `GIN (barcode gin_trgm_ops)` on assets | fuzzy barcode | Proposal |
| `tsvector GIN` on assets(name, description) | full-text | Proposal |
| `(status_id, category_id, location_id)` composite | filtered lists | Proposal |
| `(tenant_id, created_at)` on audit/movements | range queries | Proposal |

> No index is applied in this phase without approval (schema-free). MVP relies on existing indexes + ILIKE.

---

## 13. Performance Strategy

- **Field registry + query builder** prevent N+1 and redundant queries.
- **Index-aware** filters where indexes exist; `ILIKE` fallback otherwise.
- **Limit caps** bound memory/time.
- **Parallel** global search across providers.
- **Cursor pagination** (register) for large sets.
- **Recommendation:** materialized read-model later (>50k assets) — register.

---

## 14. API Design

| Endpoint | Method | Permission | Purpose |
|---|---|---|---|
| `/search/assets` | GET | asset.view | advanced asset search |
| `/search/movements` | GET | movement.view | advanced movement search |
| `/search/audit` | GET | audit.view | advanced audit search |
| `/search/global` | GET | search.global | cross-resource search |
| `/search/saved` | GET/POST | search.save | list/create saved searches |
| `/search/saved/:id` | PATCH/DELETE | search.save | update/delete saved search |

**Query params (assets example):** `q, barcode, serial_number, category_id, location_id, employee_id, status_id, purchase_date_from, purchase_date_to, price_from, price_to, sort, dir, page, limit`.

---

## 15. Database Impact

- **No new tables** (saved searches reuse `settings` key-value, per user).
- **No schema change** for MVP (uses existing columns + `ILIKE`).
- Index additions are **proposals only** pending approval.
- RLS and tenant scoping preserved everywhere.

---

## 16. Test Strategy

- **Unit:** `SearchQueryBuilder` (field validation, coercion, sort/pagination normalization).
- **Integration:** assets search across all filters + sorting + pagination; movements filters; audit filters; tenant isolation; global search grouping; saved-search CRUD (per-user isolation).
- **E2E:** `/search/assets` returns filtered/paginated results; permission-less → 403; unauth → 401; tenant isolation.
- **Regression:** all existing 124 tests must remain green.

---

## 17. Open Decisions (need approval)

| # | Decision | Options |
|---|---|---|
| OD-1 | Full-text / trigram indexes now (schema change) or later? | (a) MVP no schema change (ILIKE) · (b) apply approved indexes |
| OD-2 | Saved searches storage | (a) reuse `settings` table (no new table) · (b) new `saved_searches` table |
| OD-3 | Pagination | (a) offset/limit only · (b) offset + cursor |
| OD-4 | Global search grouping | (a) grouped by resource · (b) flat ranked list |

---

## 18. Recommended Implementation Order (after approval)

1. Task A — `SearchQuery` model + `SearchQueryBuilder`.
2. Task B — `ResourceSearchProvider` (assets/movements/audit) translating to repository criteria.
3. Task C — `SearchService` (Application) + permission checks.
4. Task D — `SearchController` (`/search/*`).
5. Task E — Global search.
6. Task F — Saved searches.
7. Task G — Permissions + audit.
8. Task H — Tests (unit/integration/e2e) + regression.

---

*This specification must be approved before implementation begins.*
