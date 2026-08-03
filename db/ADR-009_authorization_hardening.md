# ADR-009 — Authorization Hardening & Governance Layer (Phase 9.5)

**Status:** Approved
**Date:** 2026-08-03
**Deciders:** Senior Enterprise Solution Architect, Backend Security Engineer, TPM
**Related:** Phase 9 permission matrix · ADR-004 (RLS) · Security Architecture (DOC-13)

---

## Context

The system moved from role-based authorization (`@Roles`) to a permission-based model (Phase 9), but three enterprise gaps remained:

1. **Permission versioning** — a JWT could outlive a permission change, so a revoked permission stayed effective until token expiry (up to 15 min).
2. **Authorization audit trail** — there was no log of who was allowed/denied a permission and why.
3. **Granular guard semantics** — the guard only supported "any of these single permissions", not arrays with ANY/ALL modes.

## Decision

Implement authorization hardening **without new tables and without schema changes**, reusing existing objects:

1. **Permission versioning** — store `permission_version` in the existing `settings` table (key-value). The JWT carries the version at issue time; `AuthGuard` compares it to the DB version on every request and forces a refresh (`PERMISSIONS_STALE`) when they differ.

2. **Authorization audit trail** — `PermissionGuard` writes an append-only authorization decision to the existing `audit_events` table (`action_type='authz'`, `table_name='permission'`, `details` JSON with user/tenant/permission/resource/action/result/reason/timestamp). Audit failures never break the authorization decision.

3. **Guard semantics** — `@RequirePermission` now accepts a single string, an array (ANY), or `{ permissions, mode: 'ANY'|'ALL' }`. `PermissionGuard` evaluates each requirement with the given mode; all requirements must pass (AND across requirements, ANY/ALL within each).

4. **Controller migration** — all `@Roles(...)` usages replaced with `@RequirePermission(...)` so no controller relies on role alone.

## Consequences

**Positive**
- Revoked permissions take effect immediately (forced refresh) — closes the stale-token window.
- Complete authorization audit trail for compliance and forensics.
- No new tables; reuses `settings` + `audit_events`.
- Uniform permission-based authorization across all controllers.

**Negative / trade-offs**
- `AuthGuard` now performs one additional DB read per request (permission version).
- `PermissionGuard` writes an audit row per guarded request (acceptable for an enterprise audit-by-design system; can be sampled later).

## Verification

- 81 existing tests continue to pass (no breaking changes).
- New tests cover: JWT versioning staleness, ANY/ALL guard modes, authorization audit rows, and a full role × action permission matrix.
