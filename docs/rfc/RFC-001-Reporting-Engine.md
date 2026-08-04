# RFC-001 — Reporting & Dashboard Engine

> **Project:** AssetX — Enterprise Asset Management System
> **RFC #:** 001
> **Title:** Reporting & Dashboard Engine
> **Status:** 🔎 Proposed (Open for comment) — *awaiting decision → ADR-012*
> **Date:** 2026-08-03
> **Author:** Senior Enterprise Solution Architect
> **Reviewers:** Product Owner, TPM, Security Engineer, Frontend Lead

---

## Purpose of this document

This is a **Request For Comments (RFC)**. It does **not** decide anything; it lays out *whether* and *how* to build the Reporting & Dashboard Engine, and the alternatives considered, so stakeholders can comment before a final **ADR** is written.

> **Process:** `RFC → ADR → Design → Implementation → Completion Report`.

---

## 1. Summary

AssetX needs a **Reporting & Dashboard Engine** — a read-only analytics layer that surfaces operational KPIs (assets, movements, inventory, aging/book value) to management and auditors, with export and scheduled delivery as later capabilities.

## 2. Motivation / Problem

- Managers need **real-time visibility** into asset health, value, and inventory progress.
- Auditors need **traceable, filterable** reporting over asset/movement/audit data.
- Today data exists in the DB but is only reachable via raw repositories; there is **no unified analytics read-model** or presentation layer.
- Export (Phase 11.3) already assumes reporting data; a formal Reporting Engine gives it a stable source.

## 3. Goals

- Read-only analytics (never mutates business data).
- KPI summaries: asset totals/status/value, movement analytics, inventory completion/discrepancies, asset aging & book value.
- Tenant-scoped, permission-gated.
- Export-ready (feeds Phase 11.3 exporters) and dashboard/BI-ready.
- Extensible to scheduled reports later.

## 4. Non-Goals (out of scope for this RFC decision)

- Data writes / transactions.
- BI tooling (Power BI) integration — later.
- Scheduled/email distribution — later (in Technical Debt Register).
- Materialized-view read model — deferred to scale trigger (>50k assets).

## 5. Proposed Solution (High Level)

```
Controller (GET /dashboard/*)        [read-only]
        │
        ▼
ReportingService (Application)      [orchestrates, no SQL]
        │
        └── ReportingRepository (Infrastructure)  [SQL aggregations]
                └── assets / movements / inventory_cycles / v_inventory_result / statuses
```

- **Aggregations in the repository** (single SQL queries).
- **Presentation mapping in the service** (DTOs).
- **Tenant + permission** enforced at the controller/guard layer.

## 6. Alternatives Considered

| Alternative | Pros | Cons | Verdict |
|---|---|---|---|
| **A — Direct SQL from controllers** | Fast to build | Breaks Clean Architecture; SQL in API layer | ❌ Reject |
| **B — Dedicated Reporting module (proposed)** | Clean, reusable, testable | More files | ✅ Preferred |
| **C — Materialized views / analytics schema** | Fastest at scale | Schema change; complexity | 🔜 Later (scale trigger) |
| **D — External BI/warehouse** | Powerful analytics | Heavy ops; not yet needed | ❌ Later |

## 7. Key Design Decisions (to be confirmed via ADR-012)

| # | Decision | Proposed |
|---|---|---|
| D1 | Layer | Dedicated Reporting module (Application + Infrastructure) |
| D2 | Read model | On-the-fly SQL aggregations (no schema change now) |
| D3 | Book value | `price − (price × rate × age)`, floor 0 (operational) |
| D4 | Permissions | `dashboard.view` for all dashboard reads |
| D5 | Export | Reporting is the data source for Phase 11.3 exporters |
| D6 | Isolation | RLS + tenant_id everywhere |

## 8. Open Questions (please comment)

1. Which KPIs are **must-have** for v1 vs nice-to-have?
2. Is the operational book-value formula acceptable for management reporting, or is an IFRS/accounting treatment needed (ADR-008 valuation)?
3. Should the engine support **custom report builder** (drag-and-drop) now or later?
4. Acceptable latency for the heaviest aggregate (target < 1 s at 10k assets)?

## 9. Impact

- **New:** `core/entities/dashboard.entity.ts`, `core/ports/reporting.port.ts`, `application/reporting.service.ts`, `infrastructure/repositories/reporting.repository.ts`, `api/dashboard/dashboard.controller.ts`.
- **Modified:** `app.module.ts`, `permission-seed.ts` (dashboard.view).
- **Schema:** none (aggregations on existing tables/views).
- **Tests:** integration + E2E + regression.

## 10. Timeline (indicative)

- RFC comment period → 1 decision cycle.
- ADR-012 → 1.
- Implementation → as scheduled (this is already largely built as Phase 8; RFC formalizes the approach and future extensions).

---

## How to comment

Add comments to this RFC (PR review / issue / inline). Comment on: goals, alternatives, open questions, impact. After the comment period, the outcome is captured in **ADR-012**.
