# 8. Verification Checklist

> **Version:** 1.0 | **Status:** Approved | **Owner:** QA Lead / DevOps
> **Last Updated:** 2026-08-03 | **Review Cycle:** Quarterly

This is the **enterprise verification checklist** applied at merge, release, and production gates. A change is not "done" until the relevant section passes.

## Before Merge (per PR)

- [ ] TypeScript compiles clean (src + test).
- [ ] Lint/format clean.
- [ ] Unit tests pass; coverage target met.
- [ ] Integration tests pass (real DB).
- [ ] Security scan (SAST) clean.
- [ ] Code review approved (1+ approver).
- [ ] No secrets in code.
- [ ] Follows Clean Architecture (no SQL/business logic in API).
- [ ] Permission-based auth + RLS preserved.
- [ ] Docs updated (if feature).

## Before Release

- [ ] Full test suite green (unit + integration + e2e).
- [ ] E2E security tests pass (401/403, tenant isolation).
- [ ] Performance checks within targets.
- [ ] Migration script + rollback verified.
- [ ] Feature flags ready.
- [ ] Release notes drafted.
- [ ] Observability (metrics/logs/tracing) added for new code.

## Before Production

- [ ] Production Readiness Checklist passed.
- [ ] Backups verified + restore tested.
- [ ] Rollback tested.
- [ ] Runbook written for operational procedures.
- [ ] Secrets in vault; no hardcoded values.
- [ ] Monitoring + alerts armed.

## Security

- [ ] AuthGuard + TenantGuard + PermissionGuard on endpoints.
- [ ] Permission versioning enforced.
- [ ] Sensitive operations audited.
- [ ] RLS enabled on business tables.
- [ ] No cross-tenant data leakage (tested).

## Testing

- [ ] Unit / integration / e2e for the change.
- [ ] Negative cases (validation, forbidden, not-found).
- [ ] Tenant isolation test.

## Performance

- [ ] Latency within targets.
- [ ] Indexes added where needed.
- [ ] No N+1 or full scans in hot paths.

## Database

- [ ] Migrations forward + rollback.
- [ ] Data dictionary / ERD updated.
- [ ] No silent schema change.

## API

- [ ] Endpoints permission-protected.
- [ ] Error codes standard.
- [ ] OpenAPI updated.

## Logging / Observability

- [ ] Structured logs; no PII in logs.
- [ ] Metrics + alerts for critical paths.
- [ ] Audit trail complete.

## Documentation

- [ ] RFC/ADR/design/completion updated.
- [ ] API reference updated.
- [ ] Admin/user guides updated (if user-facing).

## Architecture

- [ ] Clean Architecture respected.
- [ ] SOLID/DRY/KISS applied.
- [ ] No speculative code (YAGNI).

## Review

- [ ] All mandatory items above addressed or explicitly deferred with a tracked item.
