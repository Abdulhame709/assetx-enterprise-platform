# Release Plan — AssetX

> **Version:** 1.0 | **Status:** Living artifact | **Owner:** TPM / CAB
> **Last Updated:** 2026-08-03

Single, versioned release plan. Semantic versioning (MAJOR.MINOR.PATCH).

| Release | Version | Content | Status |
|---|---|---|---|
| Backend Core | v0.1.0 (dev) | Auth, RBAC, tenant, assets, master data, inventory, movements | ✅ Internal complete |
| Backend Intelligence | v0.2.0 (dev) | Reporting, audit/compliance, notifications, SSE, export, search | ✅ Internal complete |
| Reporting Enhancements | v0.3.0 | Scheduled reports, report builder, PDF polish | 🔜 Planned |
| Lifecycle Automation | v0.4.0 | Rules engine, compliance expansion, integrity checker | Backlog |
| Production Hardening | v1.0.0-rc | Async export, S3, performance, retention | Backlog |
| **v1.0.0** | Web + Backend | **First production release (Web)** | Backlog |
| v1.1.0 | Mobile | Field app + offline sync | Backlog |
| v2.0.0 | SaaS | Multi-tenant activation, billing, integration hub | Backlog |

## Release gate

Each release must pass `8_Verification_Checklist.md`, `9_Release_Checklist.md`, and `10_Production_Readiness_Checklist.md` (for production releases).

## Rules

- One release plan (this file) — no parallel contradictory plans.
- Releases are cut from `main` per `9_Release_Checklist.md`.
