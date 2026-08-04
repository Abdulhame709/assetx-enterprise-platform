# Milestones — AssetX

> **Version:** 1.0 | **Status:** Living artifact | **Owner:** TPM
> **Last Updated:** 2026-08-03

Milestones are major delivery checkpoints, each gated by Definition of Done + verification checklist.

| Milestone | Scope | Exit Criteria | Status |
|---|---|---|---|
| **M1 — Backend Core** | Auth, RBAC, tenant, assets, master data, inventory, movements | 137 tests pass; backend APIs complete | ✅ Done |
| **M2 — Intelligence** | Reporting, audit/compliance, notifications, SSE, export, advanced search | Reporting/export/search APIs live; tested | ✅ Done |
| **M3 — Reporting Enhancements** | Scheduled reports, report builder, PDF polish | Reporting E2E; scheduled job | 🔜 Next |
| **M4 — Lifecycle Automation** | Rules engine, compliance expansion, integrity checker | Alerts + health score | Backlog |
| **M5 — Production Hardening** | Async export, S3, performance, retention | Async export + queue | Backlog |
| **M6 — Web Frontend** | Shell, dashboard, assets, search UI | Web usable | Backlog |
| **M7 — Mobile + Offline** | Field app, offline sync | Mobile field count works offline | Backlog |
| **M8 — Deploy & Ops** | Supabase prod, CI/CD, backups, monitoring | Production ready (checklist) | Backlog |

## Milestone Rules

- A milestone is reached only when **all** its exit criteria pass.
- Phase gate review (TRB/CAB) per milestone.
- Milestones are the basis of the Release Plan and Roadmap.
