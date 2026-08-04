# Traceability Matrix — AssetX

> **Version:** 1.0 | **Status:** Living artifact | **Owner:** QA / Architect
> **Last Updated:** 2026-08-03

Traces **Business Requirement → Feature → API → Database → Tests → Documentation** so nothing is lost. Rows are the core capabilities (primary trace paths); full per-module detail lives in the referenced docs/tests.

| Business Requirement | Feature/Module | API | Database | Tests | Documentation |
|---|---|---|---|---|---|
| Secure access (BO) | Authentication | `/auth/*` | users, sessions | auth.integration.spec | API Spec · Admin Guide |
| Least privilege (BR-SEC-005) | Authorization | `/assets`, all | permissions, role_permissions | permissions.spec, authorization-hardening.spec | Security Arch · Permission Matrix |
| Tenant isolation (ADR-004) | RLS | all | tenant_id + RLS | security.integration.spec | Security Arch · DDS |
| Asset registry (BO-003) | Assets | `/assets` | assets | asset.*.spec | API Spec · Entity Spec |
| Asset lifecycle (BO-004) | Movements | `/assets/:id/movements` | asset_movements | movement.*.spec | Entity Spec · ADR-007 |
| Inventory (BO-001/005) | Inventory | `/inventory/*` | inventory_cycles/records | inventory.*.spec | Entity Spec · FRS |
| Smart field inventory (BO-005) | Mobile+Offline | `/sync/*` | SQLite local | (future mobile specs) | Mobile Spec |
| Reporting (BO-006) | Reporting | `/dashboard/*` | v_inventory_result | reporting.*.spec | API Spec · FRS |
| Audit trail (BO-004) | Audit | `/audit/*` | audit_events | audit.*.spec | Audit Guide · ADR-010 |
| Compliance (BO-007) | Compliance | `/compliance/health` | — (queries) | compliance in audit.spec | ADR-010 |
| Notifications | Notifications | `/notifications` | notifications | notification.*.spec | Notification docs |
| Realtime | SSE | `/notifications/stream` | — | realtime.*.spec | Realtime docs |
| Export | Export | `/exports/*` | — | export.*.spec | Export report |
| Search | Search | `/search/*` | saved_searches | search.*.spec, saved-search.*.spec | Search spec |
| Permissions on all | Permission matrix | @RequirePermission | permissions | permission tests | Security Arch |

## Rules

- Every new feature adds a **row** here linking BR → Feature → API → DB → Tests → Docs.
- If any column is missing, the feature is not **Done**.
- This matrix is the basis of release sign-off and audit.
