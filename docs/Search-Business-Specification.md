# Advanced Search — Business & UX Specification

> **Project:** AssetX — Enterprise Asset Management System
> **Phase:** 11.4 — Advanced Search Engine
> **Document Type:** Business & UX specification (non-technical)
> **Status:** ✅ Approved
> **Date:** 2026-08-03
> **Companion:** `Advanced-Search-Design-Specification.md` (technical)

---

## 1. Search Personas

| Persona | Role | Primary Search Need | Search Frequency |
|---|---|---|---|
| **Field Agent** | Inventory Team | Find an asset by scanning/typing barcode or serial quickly on mobile | Very high (during inventory) |
| **Asset Manager** | Asset custodian | Locate assets by location/category/status/value to manage the portfolio | High |
| **Auditor** | Compliance reviewer | Trace audit events, movements, and anomalies for a specific asset or user | High (periodic) |
| **Department Manager** | Unit head | View assets within their department/scope, filter by condition | Medium |
| **Administrator** | System admin | Global searches, user activity, and saved-search management | Medium |
| **Employee** | Asset holder | Find assets assigned to themselves | Low |

**Key insight:** speed and relevance matter most for **Field Agents** (barcode/serial), while **Auditors** need **traceability filters** (user/action/date).

---

## 2. Business Search Scenarios

| # | Scenario | Persona | Expected Outcome |
|---|---|---|---|
| S1 | "Find the printer in floor 2" | Field Agent | Asset matched by name/serial, location shown |
| S2 | "List all laptops under maintenance" | Asset Manager | Filtered list by status + category |
| S3 | "Which assets have no assigned owner?" | Asset Manager | Assets with empty employee filter |
| S4 | "Show movements pending approval in last 7 days" | Asset Manager | Movement list filtered by status + date |
| S5 | "Audit trail of asset X" | Auditor | Timeline via audit search by record_id |
| S6 | "What did user Y change this week?" | Auditor | Audit events filtered by user + date |
| S7 | "All assets valued above 50k" | Dept Manager | Assets filtered by price range |
| S8 | "Global: does 'HP LaserJet' exist anywhere?" | Administrator | Grouped results across assets/movements/audit |
| S9 | "Re-run my saved 'High-value assets' search" | Asset Manager | Saved search restored with current data |
| S10 | "Show assets purchased in 2024" | Auditor | Assets filtered by purchase date range |

---

## 3. Supported Search Operators

| Operator | Symbol / Syntax | Meaning | Example |
|---|---|---|---|
| Equals | `field=value` | exact match | `status_id=<id>` |
| Contains | `q=` (free text) | substring / fuzzy on name/code/serial/barcode | `q=HP` |
| In list | `field=val1,val2` | any of the given values | `status_id=a,b` |
| Range (numbers) | `from..to` | inclusive numeric range | `price=1000..5000` |
| Range (dates) | `field_from`, `field_to` | date window | `purchase_date_from=2024-01-01` |
| Is empty / Is not empty | `field=empty` | presence/absence of a value | `employee=empty` (unassigned) |
| Boolean | `field=true/false` | flag values | `is_active=true` |

> **Simple-to-advanced:** the UI starts with a simple text `q` box and an "Advanced filters" expander exposing the operator-aware controls.

---

## 4. Advanced Filter Matrix

### Assets
| Field | Operator(s) | Notes |
|---|---|---|
| Name | contains | free text |
| Full / Base code | contains | exact-ish |
| Barcode | contains / equals | scanned value |
| Serial number | contains | fuzzy allowed |
| Reference number | contains | |
| Category | in | incl. parent→children |
| Location | in | incl. descendants |
| Employee (owner) | in / empty | unassigned support |
| Status | in | |
| Purchase date | range | |
| Purchase price | range | numeric |
| Inventory year | equals | |
| Is active | boolean | |

### Movements
| Field | Operator(s) | Notes |
|---|---|---|
| Movement type | in | transfer/assignment/return/disposal/retirement/maintenance_return |
| Status | in | pending/approved/rejected |
| Created date | range | |
| Performed by (user) | in | |
| Asset | equals | |
| Reason / reference | contains | |

### Audit
| Field | Operator(s) | Notes |
|---|---|---|
| Action type | in | from audit event catalog |
| Entity (table) | in | asset/movement/inventory/... |
| User | in | |
| Record id | equals | for asset timelines |
| Date | range | |

---

## 5. Saved Search Templates

Out-of-the-box named templates (per user, editable/duplicable):

| Template | Resource | Filter |
|---|---|---|
| "High-value assets" | Assets | price ≥ 50,000 |
| "Under maintenance" | Assets | status = Under Maintenance |
| "Unassigned assets" | Assets | owner = empty |
| "Pending approvals" | Movements | status = pending |
| "Recent changes" | Audit | date = last 7 days |
| "My assets" | Assets | owner = me |

- Users can save their own searches with a name.
- Saved searches are **per-user** (private), not shared.

---

## 6. Global Search Behaviour

- Single query across **Assets, Movements, Audit**.
- Results **grouped by resource** (approved decision OD-4A).
- Order of groups: **Assets first**, then Movements, then Audit.
- Within a group, results ranked by the ranking rules (§7).
- Each group shows a count; user can drill into the full filtered list.
- Tenant-scoped: never crosses tenant boundaries.

---

## 7. Search Ranking Rules

Within a resource, results are ranked by relevance (most specific match first):

1. **Exact code match** (full_asset_code / base_asset_code) — highest.
2. **Exact barcode / serial match** — high.
3. **Name prefix match** — medium-high.
4. **Name substring / fuzzy** — medium.
5. **Other text fields (description, reference, notes)** — lowest.
6. **Tie-break:** alphabetical by name, then created date.

> Ranking is deterministic so pagination is stable.

---

## 8. Search UX Rules

- **Fast entry:** typing in `q` triggers search (debounced, e.g. 300 ms) per AAB §13.11.
- **Advanced filters** in a collapsible panel; applied via a "Search" button or Enter.
- **Clear filters** action restores defaults.
- **Result count** shown ("1,245 results").
- **Empty states:** friendly message + hint ("Try removing a filter").
- **No results suggestions:** "Did you mean ..." when a trigram close match exists (deferred, see §13).
- **Pagination / load-more:** consistent across resources.
- **Saved searches:** quick dropdown + "Save current" action.
- **Responsive:** same search works on Web and Mobile (field app prioritizes barcode/serial entry).

---

## 9. Performance Targets

| Metric | Target |
|---|---|
| Simple search (`q`) response | < 500 ms (NFR-PRF-002) |
| Filtered list (10k assets) | < 1 s |
| Global search | < 1.5 s |
| Search with pagination | constant time per page |
| Barcode/serial lookup | < 300 ms |
| Typeahead debounce | 300 ms |

---

## 10. Permission Matrix

| Permission | Assets search | Movements search | Audit search | Global | Saved searches |
|---|---|---|---|---|---|
| Administrator | ✅ | ✅ | ✅ | ✅ | ✅ |
| Asset Manager | ✅ | ✅ | ❌ | ✅ | ✅ |
| Auditor | ✅ | ✅ | ✅ | ✅ | ✅ |
| Department Manager | ✅ | ✅ | ❌ | ✅ | ✅ |
| Inventory Team | ✅ | ❌ | ❌ | ❌ | ❌ |
| Maintenance | ✅ | ✅ | ❌ | ❌ | ❌ |
| Employee | ✅ | ❌ | ❌ | ❌ | ❌ |

> Effective permission = resource view permission + (global / save) permission where applicable.

---

## 11. Error Handling

| Scenario | Behaviour |
|---|---|
| Invalid operator / field | Clear validation error; field highlighted; no query executed |
| Invalid date / number format | Coercion error message; filter ignored with warning |
| Page out of range | Return empty list + hasMore=false (no error) |
| No permission | 403 `FORBIDDEN` |
| Unauthenticated | 401 `UNAUTHORIZED` |
| Search too broad / slow | Cap applied; hint to narrow filters |
| Timeout | 504 with retry suggestion |

---

## 12. Acceptance Criteria

1. Assets can be searched by barcode, serial, category, location (incl. children), employee, status, purchase-date range, and value range.
2. Movements can be searched by type, status, date range, and user.
3. Audit can be searched by action, entity, user, and date.
4. All searches support sorting and offset/limit pagination with stable `total`.
5. Free-text `q` matches name/code/serial/barcode via ILIKE (no schema change).
6. Global search returns grouped results (assets, movements, audit) with counts.
7. Saved searches can be created, listed, updated, deleted — per user, isolated.
8. Tenant isolation holds: tenant A never sees tenant B results.
9. Permission guard: unauthorized → 401, permission-less → 403.
10. All performance targets in §9 met (measured in tests).
11. All existing 124 tests remain passing; new advanced-search tests added.

---

## 13. Out-of-Scope Items

| Item | Reason | Where tracked |
|---|---|---|
| Full-text (tsvector) index & operators | Requires schema change — deferred | Technical Debt Register (OD-1 → A) |
| Trigram fuzzy + "did you mean" | Requires pg_trgm index — deferred | Technical Debt Register |
| Cursor pagination | Chosen offset/limit for this phase (OD-3 → A) | Technical Debt Register |
| Vector / AI semantic search (pgvector) | Later AI phase | Technical Debt Register |
| Elasticsearch / external search index | Scale decision later | Technical Debt Register |
| Faceted aggregations (counts per filter) | Enhancement | Future |
| Cross-tenant search | Prohibited by RLS | — |

---

*Approved. Implementation follows the technical design (`Advanced-Search-Design-Specification.md`) and this business spec together.*
