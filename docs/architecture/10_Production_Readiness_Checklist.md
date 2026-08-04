# 10. Production Readiness Checklist

> **Version:** 1.0 | **Status:** Approved | **Owner:** DevOps / SRE / CAB
> **Last Updated:** 2026-08-03 | **Review Cycle:** Per production release

The **final production gate**. A release is not production-ready until every section passes.

## Architecture

- [ ] Clean Architecture respected; no business logic in API.
- [ ] Modular monolith boundaries clear.
- [ ] Offline-first + sync design intact (where applicable).
- [ ] Event-driven readiness (EventBus) preserved.

## Security

- [ ] OWASP ASVS L2 satisfied (MVP).
- [ ] MFA-ready; JWT 15m + refresh 7d.
- [ ] RBAC + permission matrix enforced; permission versioning on.
- [ ] RLS on all business tables; tenant isolation tested.
- [ ] Encryption at rest (AES-256) + in transit (TLS 1.3).
- [ ] Secrets in vault (none in code).
- [ ] Audit trail complete + immutable.

## Performance

- [ ] Latency within NFR targets.
- [ ] Load/stress/soak tests passed (k6).
- [ ] Indexes present for hot paths.
- [ ] Caching strategy defined (Redis, CDN).

## Database

- [ ] Migrations versioned + rollback verified.
- [ ] Backup + restore tested (monthly).
- [ ] PITR (WAL) configured.
- [ ] Data dictionary / ERD current.

## Caching

- [ ] Redis configured (L1); CDN (L2) where needed.
- [ ] Cache invalidation strategy defined.

## Queues

- [ ] Background jobs (BullMQ) configured.
- [ ] Retry + dead-letter strategy.

## Secrets

- [ ] Vault integration; rotation plan.

## Monitoring / Tracing / Logging

- [ ] Metrics (Prometheus/Grafana) live.
- [ ] Logs (Loki) structured; no PII.
- [ ] Tracing (OpenTelemetry) for critical flows.
- [ ] Error tracking (Sentry) enabled.
- [ ] Alerts for P1/P2 with escalation.

## Disaster Recovery / Backup

- [ ] RPO/RTO defined (MVP 24h/8h; Enterprise 15m/1h).
- [ ] Backup types + retention per policy.
- [ ] DR runbook (RB-006) rehearsed.

## CI/CD

- [ ] Pipeline green; quality gates enforced.
- [ ] Rollback automated on health-check failure.
- [ ] Feature flags + Blue/Green/canary.

## Scalability

- [ ] Capacity plan (MVP 10k assets/100 users).
- [ ] Horizontal scaling path defined.

## Cost

- [ ] Cost KPIs defined (per tenant/asset/request).
- [ ] Reserved capacity + monthly review.

## Compliance

- [ ] GDPR-ready; retention policies.
- [ ] Data classification enforced (PII handling).

## Testing

- [ ] Full regression green.
- [ ] Security tests (tenant isolation, 401/403).
- [ ] Performance tests within targets.

## Documentation

- [ ] Architecture, security, deployment, API, DB, audit guides current.
- [ ] Runbooks written.
- [ ] Admin/user guides updated.

## Support / Operations

- [ ] L1/L2/L3 support model ready.
- [ ] Escalation matrix defined.
- [ ] On-call + incident plan.
- [ ] Operations manual current.

## Final gate

- [ ] **All mandatory items above pass** — otherwise the release is blocked until remediation and re-review.

## Cross-reference

- `9_Release_Checklist.md`
- `DevOps/CI_CD_Guide.md`
- `Operations/Operations_Manual.md`
- `Security/Security_Architecture.md`
- `docs/architecture/8_Verification_Checklist.md`
