# Project Backlog — AssetX

> **Version:** 1.0 | **Status:** Living artifact (updated each sprint) | **Owner:** Product Owner + TPM
> **Last Updated:** 2026-08-03 | **Review Cycle:** Each sprint planning

This is the **executable backlog**, not a requirements document. It tracks work from Epic → Task with priority, dependencies, risk, and status. It reflects the current implementation state (backend core built & tested through Phase 11.4).

## Legend

- **Priority:** P0 (blocker) · P1 (must) · P2 (should) · P3 (could)
- **Status:** Backlog · Ready · In Progress · In Review · Done
- **Estimate:** S/M/L/XL (story points in sprint planning)

---

## Epic E-1 — Core Platform (DONE)

| Feature | Stories | Priority | Status | Depends on |
|---|---|---|---|---|
| Authentication | login/register/logout/refresh | P1 | Done | — |
| Authorization | RBAC + permission matrix + JWT versioning | P1 | Done | Auth |
| Tenant isolation | RLS + tenant context | P1 | Done | DB |
| Assets | CRUD, codes, QR, transfer, status | P1 | Done | Master data |
| Master Data | locations/categories/models/employees | P1 | Done | DB |
| Inventory | cycle/records/result engine | P1 | Done | Assets |
| Movements | 6 types + approval workflow | P1 | Done | Assets |
| Reporting | 4 dashboards | P1 | Done | Data |
| Audit & Compliance | audit engine + compliance checks | P1 | Done | Auth |
| Notifications | event bus + notifications | P2 | Done | Auth |
| Realtime (SSE) | notification stream | P2 | Done | Notifications |
| Export | csv/xlsx/pdf | P2 | Done | Reporting |
| Advanced Search | assets/movements/audit + saved searches | P2 | Done | Data |

## Epic E-2 — Reporting Engine Enhancements (NEXT)

| Feature | Stories | Priority | Status | Depends on | Risk |
|---|---|---|---|---|---|
| Scheduled reports | cron delivery | P2 | Backlog | Export, Email | Low |
| Report builder | custom filters/columns | P3 | Backlog | Reporting | Medium |
| PDF advanced formatting | headers/footers/Arabic | P3 | Backlog | Export | Medium |
| Custom report templates | saved report layouts | P3 | Backlog | Saved searches | Medium |

## Epic E-3 — Lifecycle Automation

| Feature | Stories | Priority | Status | Depends on | Risk |
|---|---|---|---|---|---|
| Rules engine | replacement/maintenance/high-value alerts | P2 | Backlog | Data, Notifications | Medium |
| Compliance expansion | barcode/category/escalation checks | P2 | Backlog | Compliance | Medium |
| Integrity checker | orphan/duplicate/broken-ref score | P2 | Backlog | DB | Medium |

## Epic E-4 — Production Hardening

| Feature | Stories | Priority | Status | Depends on | Risk |
|---|---|---|---|---|---|
| Async export + queue | BullMQ job + download | P2 | Backlog | Export | Medium |
| S3 storage | upload generated files | P3 | Backlog | Async export | Medium |
| Performance optimization | slow queries/indexes | P2 | Backlog | Data | Medium |
| Audit retention job | partition/archive | P3 | Backlog | Audit | Low |

## Epic E-5 — Frontend (Web)

| Feature | Stories | Priority | Status | Depends on | Risk |
|---|---|---|---|---|---|
| App shell + layout | navigation, theme | P1 | Backlog | Auth | Medium |
| Dashboard screens | 4 dashboards | P1 | Backlog | Reporting | Medium |
| Asset management screens | list/detail/create | P1 | Backlog | Assets | Medium |
| Auth pages | login/register | P1 | Backlog | Auth | Low |
| Search & filters UI | advanced search | P1 | Backlog | Search | Medium |
| Notifications UI | list/stream | P2 | Backlog | SSE | Low |

## Epic E-6 — Frontend (Mobile) & Offline Sync

| Feature | Stories | Priority | Status | Depends on | Risk |
|---|---|---|---|---|---|
| Mobile auth | login | P1 | Backlog | Auth | Medium |
| Field inventory UI | scan/QR/count | P1 | Backlog | Inventory | High |
| Offline store + sync | SQLite/queue/conflict | P1 | Backlog | API | High |

## Epic E-7 — Deployment & Operations

| Feature | Stories | Priority | Status | Depends on | Risk |
|---|---|---|---|---|---|
| Supabase/Postgres production DB | migrate off PGlite | P1 | Backlog | DB | High |
| CI/CD pipeline | GitHub Actions/Docker | P1 | Backlog | Backend | Medium |
| Secrets + env config | vault | P1 | Backlog | CI/CD | Medium |
| Backups + monitoring | RPO/RTO + observability | P1 | Backlog | Deploy | Medium |

---

## Backlog Rules

- Backlog is **priority-ordered**; the Product Owner owns prioritization.
- A story moves to **Ready** only when it meets Definition of Ready (`docs/project/Definition_of_Ready.md`).
- **Done** requires Definition of Done (`docs/project/Definition_of_Done.md`).
- New work is added as stories under the correct Epic — no free-floating items.
- Technical debt lives in `docs/Technical-Debt-Register.md`, not the backlog.
