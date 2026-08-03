# ADR-010 — Enterprise Audit Trail & Compliance Engine (Phase 10)

**Status:** Approved
**Date:** 2026-08-03
**Deciders:** Senior Enterprise Backend Architect, Security Engineer, Software Auditor
**Related:** ADR-009 (authorization hardening) · ADR-004 (RLS) · Entity Spec §5.17 · Security Architecture (DOC-13)

---

## Context

The system recorded some operations (permission allow/deny via `PermissionGuard`) but lacked a **complete enterprise audit & compliance platform**. Requirements: a unified audit framework, automatic API request auditing, domain/business event logging, compliance data-integrity checks, and audit-facing APIs.

## Decision

Build the audit & compliance layer **without new tables and without schema changes**, reusing the existing `audit_events` table and the existing `permissions`/`role_permissions` authorization model.

### Architecture
- **AuditRepository** (Infrastructure) — persists/retrieves audit rows only; no business logic.
- **AuditService** (Application) — validation (event keys from catalog), mapping, classification, querying, asset timeline, security query.
- **AuditInterceptor** (Common, global via `APP_INTERCEPTOR`) — records **HTTP-level** request metadata only (endpoint, method, status, duration, user, tenant, IP, user-agent). It does **not** record business events.
- **Event Catalog** (`core/constants/audit-events.ts`) — single source of truth for action keys; services reference constants, never raw strings.
- **Domain events** are logged inside the **Application Services** (AssetService, MovementService, CycleService, AuthService) — not in the interceptor — to avoid duplicate logging.

### Responsibility separation (no duplicate events)
| Concern | Where logged |
|---|---|
| API request (HTTP level) | `AuditInterceptor` (`API_REQUEST`) |
| Permission allow/deny | `PermissionGuard` → `AuditService` (`PERMISSION_GRANTED`/`PERMISSION_DENIED`) |
| Business events (asset/movement/inventory/auth) | Application Services |
| Compliance checks | `ComplianceService` (`COMPLIANCE_WARNING`) |

### PermissionGuard refactor
`PermissionGuard` no longer writes directly to `audit_events`; it delegates to `AuditService` → `AuditRepository` → `audit_events`, guaranteeing a single audit write path.

### Compliance Engine
`ComplianceService.health()` checks: assets without location/status/owner, stale pending movements (>7 days), open inventory cycles, users without permissions. Returns per-check status and overall OK/WARNING; logs a `COMPLIANCE_WARNING` when any check fails.

### Audit & Compliance APIs
- `GET /audit/events` (filters: action, entity, user, date_from, date_to, page, limit) — `audit.view`
- `GET /audit/security` (login failures, permission denied/changed) — `audit.view`
- `GET /audit/assets/:id` (asset timeline, chronological) — `audit.view`
- `GET /compliance/health` — `compliance.view`

`audit.view` and `compliance.view` are granted to **Administrator** and **Auditor** only.

## Why reuse `audit_events`
- It already has the required columns (`action_type`, `table_name`, `record_id`, `details` jsonb, `ip_address`, `user_agent`, `created_at`) and **RLS tenant isolation** + indexes.
- Adding a new table would duplicate storage and fragment the audit trail; the existing table is the natural home for all audit/activity records.

## Why interceptor + service separation
- The interceptor captures **transport** facts (HTTP method, status, duration, IP) that the domain services don't know.
- The services capture **business** facts (what entity changed, why). Separating them prevents either from trying to capture the other's domain and avoids duplicate logging.

## Security model
- Audit rows are **append-only** (no UPDATE/DELETE path; `created_at` only).
- Tenant isolation via **RLS** on `audit_events` + a `tenant_id` filter in `AuditRepository.search`.
- Read access gated by `audit.view` / `compliance.view` (permission-based, not role-based).
- Audit writes never break the request (all `.catch(() => undefined)` / internal try-catch).

## Retention recommendation
- Keep audit events per the retention policy (AAB §11W: audit log 7 years). Recommend partitioning `audit_events` by time/tenant at scale and archiving beyond the retention window. Index `(tenant_id, created_at)`, `action_type`, `user_id`, `record_id` for query performance (recommendation only — not applied to avoid schema churn).

## Verification
- 93 existing tests continue to pass.
- New tests: audit integration (8: asset event, auth login success/fail, permission denied, asset timeline, search/pagination, tenant isolation, compliance checks), audit E2E (3: /audit/events RBAC + 401 + 403, /audit/security + /compliance/health, cross-tenant isolation).
