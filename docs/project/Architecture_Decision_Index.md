# Architecture Decision Index — AssetX

> **Version:** 1.0 | **Status:** Living artifact | **Owner:** Architect
> **Last Updated:** 2026-08-03

A **one-line index** of all ADRs (no new ADRs here). Full ADRs live in `db/ADR-*.md`.

| ADR | Title | Status |
|---|---|---|
| ADR-001 | UUID instead of IDENTITY | ✅ Accepted |
| ADR-002 | Modular Monolith before Microservices | ✅ Accepted |
| ADR-003 | Offline Sync Strategy | ✅ Accepted |
| ADR-004 | Multi-Tenant Strategy (tenant_id + RLS) | ✅ Accepted |
| ADR-005 | Hierarchy Strategy (Materialized Path/LTREE) | ✅ Accepted |
| ADR-006 | Observability Strategy | ✅ Accepted |
| ADR-007 | Backup Strategy | ✅ Accepted |
| ADR-008 | Integration Strategy | ✅ Accepted |
| ADR-009 | Governance Strategy | ✅ Accepted |
| ADR-010 | Monitoring Stack | ✅ Accepted |
| ADR-011 | Event Bus Strategy | ✅ Accepted |
| ADR-012 | Cost Optimization | ✅ Accepted |
| ADR-013 | AI Usage Strategy | ✅ Accepted |
| ADR-014 | Release Strategy | ✅ Accepted |
| ADR-015 | Disaster Recovery | ✅ Accepted |
| ADR-016 | Frontend Authentication Integration (PRE-P3.1) | ✅ Accepted |
| ADR-007 | Extend Asset Movement Lifecycle | ✅ Accepted |
| ADR-009 | Authorization Hardening | ✅ Accepted |
| ADR-010 | Audit & Compliance Engine | ✅ Accepted |
| ADR-011 | saved_searches table | ✅ Accepted |

> **Note:** ADR numbering has some reused IDs (007/009/010/011 across documents). A normalization pass is a **decision-log item** — not to be done silently.

## Rules

- New architecture decisions add an ADR under `db/` and **one row here**.
- Do not rewrite ADRs here — this is an index only.
