# Sprint Planning — AssetX

> **Version:** 1.0 | **Status:** Living artifact | **Owner:** Scrum Master / TPM
> **Last Updated:** 2026-08-03 | **Review Cycle:** Each sprint

Sprint cadence: **2 weeks**. Each sprint delivers an increment meeting Definition of Done.

## Sprint 1 — Reporting Engine Enhancements (foundation)

| Story | Epic | Size | Owner | Status |
|---|---|---|---|---|
| Scheduled report infra (cron job) | E-2 | L | Backend | Planned |
| Report export polish (PDF advanced) | E-2 | M | Backend | Planned |
| Custom report columns/templates | E-2 | XL | Backend | Backlog |
| Compliance expansion (barcode/category) | E-3 | M | Backend | Planned |
| Integrity checker (score 0-100) | E-3 | M | Backend | Planned |

**Sprint Goal:** Extend the reporting & compliance layer with scheduled/summary capabilities.

## Sprint 2 — Lifecycle Automation

| Story | Epic | Size | Owner | Status |
|---|---|---|---|---|
| Rules engine (replacement/maintenance/high-value) | E-3 | XL | Backend | Backlog |
| Rules notifications via EventBus | E-3 | M | Backend | Backlog |
| Performance pass (slow queries/indexes) | E-4 | L | Backend | Backlog |

## Sprint 3 — Async & Production

| Story | Epic | Size | Owner | Status |
|---|---|---|---|---|
| Async export + BullMQ queue | E-4 | L | Backend | Backlog |
| Download endpoint + retry | E-4 | M | Backend | Backlog |
| Audit retention job | E-4 | M | Backend | Backlog |

## Sprint 4+ — Frontend Web (start)

| Story | Epic | Size | Owner | Status |
|---|---|---|---|---|
| Web app shell + auth pages | E-5 | L | Frontend | Backlog |
| Dashboard screens | E-5 | L | Frontend | Backlog |
| Asset management screens | E-5 | L | Frontend | Backlog |

---

## Sprint Planning Rules

- Capacity = velocity × availability (adjust for leave/ceremonies/tech-debt).
- Only **Ready** stories enter a sprint (DoR met).
- Sprint Goal is set; scope is the commitment; unplanned work is blocked by the Scrum Master.
- Story sizes estimated with Fibonacci points at refinement.
