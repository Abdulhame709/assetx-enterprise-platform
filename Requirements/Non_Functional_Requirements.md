# NON-FUNCTIONAL REQUIREMENTS (NFR)
## AssetX Enterprise Platform

> **Document ID:** `REQ-NFR-001` | **Version:** 1.0 | **Status:** Approved Baseline
> **Reference:** AAB v6.0 (§11B, §11R, §11S, §11W, §11X) · PEP v1.0
> **Path:** `Requirements/Non_Functional_Requirements.md`

---

## 0. Document Control

| Field | Value |
|---|---|
| **Document Title** | Non-Functional Requirements (NFR) |
| **Document Owner** | Senior Solution Architect |
| **Contributors** | DevOps, QA, SecOps, Performance Engineering |
| **Authoritative Basis** | AAB v6.0 (NFR targets) |
| **Approval Body** | CAB |
| **Version** | 1.0 |

---

## 1. Introduction

### 1.1 Purpose

Defines the **quality attributes and constraints** of the AssetX platform: performance, availability, scalability, security, usability, maintainability, reliability, compliance, and observability. These are validated through the Testing Strategy and monitored in operations.

### 1.2 NFR Categorization

| Category | Concern |
|---|---|
| Performance & Scalability | Speed, capacity |
| Availability & Reliability | Uptime, SLA, RPO/RTO |
| Security | Confidentiality, integrity, compliance |
| Usability & Accessibility | UX, Arabic-first, i18n |
| Maintainability & Portability | Code health, deployment |
| Observability & Operability | Monitoring, logging, tracing |
| Compliance & Data Governance | GDPR, retention, privacy |

---

## 2. Performance Requirements

| ID | Requirement | Target | Verification |
|---|---|---|---|
| `NFR-PRF-001` | Dashboard load time | < 2 s | Load test (k6) |
| `NFR-PRF-002` | Search latency | < 500 ms | Performance test |
| `NFR-PRF-003` | Asset list (10K rows) | < 1 s | Performance test |
| `NFR-PRF-004` | Sync rate | ≥ 1000 records/min | Sync test |
| `NFR-PRF-005` | QR scan → display | < 300 ms | Mobile perf test |
| `NFR-PRF-006` | API p95 latency | < 500 ms | Monitoring |
| `NFR-PRF-007` | DB query p95 | < 100 ms | Monitoring |

### 2.1 Performance Strategy (from AAB §11X)

- Caching: L1 Redis, L2 CDN, L3 materialized views, L4 HTTP.
- Indexing: GIN (LTREE), B-Tree, partial indexes.
- Pagination: cursor-based (no OFFSET).
- Partitioning by tenant_id for large tables.
- Connection pooling (PgBouncer).
- Read replicas for reporting/dashboards.

---

## 3. Scalability Requirements

| ID | Requirement | MVP | Enterprise |
|---|---|---|---|
| `NFR-SCL-001` | Max assets | 10,000 | 10,000,000 |
| `NFR-SCL-002` | Max users | 100 | 10,000 |
| `NFR-SCL-003` | Servers | 1 | Auto-scale |
| `NFR-SCL-004` | Database | Small | Large + sharding |

### 3.1 Scaling Strategy

- Horizontal scaling of stateless services.
- Read replicas + partitioning for DB growth.
- Auto-scaling for compute.
- Capacity planning reviewed at each phase gate (PEP §45/§48).

---

## 4. Availability & Reliability Requirements

| ID | Requirement | MVP | Enterprise |
|---|---|---|---|
| `NFR-AVL-001` | Service SLA | 99.5% | 99.9% |
| `NFR-AVL-002` | RPO (data loss allowed) | 24 h | 15 min |
| `NFR-AVL-003` | RTO (restore time) | 8 h | 1 h |
| `NFR-AVL-004` | Backup restore test | Monthly | Monthly |

### 4.1 Reliability Strategy

- Hot standby / read replica (MVP).
- Multi-AZ / multi-region (Enterprise).
- Automated health-check-based failover.
- Error budgets (AAB §11R): 0.1% ≈ ~43 min/month downtime allowed.

---

## 5. Security Requirements

| ID | Requirement | Target |
|---|---|---|
| `NFR-SEC-001` | Application security standard | OWASP ASVS L2 (MVP), L3 (Enterprise) |
| `NFR-SEC-002` | Encryption at rest | AES-256 |
| `NFR-SEC-003` | Encryption in transit | TLS 1.3 |
| `NFR-SEC-004` | Password hashing | bcrypt/argon2 (cost ≥ 12) |
| `NFR-SEC-005` | Token lifetime | JWT 15 min + Refresh 7 days |
| `NFR-SEC-006` | Multi-tenancy isolation | RLS (tenant_id) |
| `NFR-SEC-007` | Secrets management | Vault; no secrets in code |
| `NFR-SEC-008` | Authentication | Supabase Auth, MFA-ready |
| `NFR-SEC-009` | Authorization | RBAC + granular permissions |
| `NFR-SEC-010` | Input validation | Zod |

### 5.1 Security Testing

- SAST on every PR.
- DAST + SCA on release candidates.
- Quarterly penetration testing.
- Threat modeling per feature.

---

## 6. Usability & Accessibility Requirements

| ID | Requirement | Target |
|---|---|---|
| `NFR-USR-001` | Primary language | Arabic (authentic), i18n to English |
| `NFR-USR-002` | Layout | RTL + LTR support |
| `NFR-USR-003` | Responsive | Mobile/Tablet/Desktop |
| `NFR-USR-004` | Dark mode | Supported |
| `NFR-USR-005` | Keyboard shortcuts | Supported (Ctrl+S, F3, F4, F5, Esc) |
| `NFR-USR-006` | PWA-ready | Yes (V5) |
| `NFR-USR-007` | Offline asset search (mobile) | Supported |

---

## 7. Maintainability & Portability Requirements

| ID | Requirement | Target |
|---|---|---|
| `NFR-MNT-001` | Code standards | AAB §11AA naming/coding standards |
| `NFR-MNT-002` | Modular monolith | ADR-002 |
| `NFR-MNT-003` | Automated tests | Unit ≥ 80% critical |
| `NFR-MNT-004` | CI/CD | GitHub Actions + Docker |
| `NFR-MNT-005` | Deployment | Blue/Green + canary (ADR-014) |
| `NFR-MNT-006` | IaC | Environments as code |
| `NFR-MNT-007` | Feature flags | Deploy/release decoupled |

---

## 8. Observability & Operability Requirements

| ID | Requirement | Tool/Target |
|---|---|---|
| `NFR-OBS-001` | Metrics | Prometheus/Grafana |
| `NFR-OBS-002` | Logs | Loki (structured JSON) |
| `NFR-OBS-003` | Tracing | OpenTelemetry |
| `NFR-OBS-004` | Error tracking | Sentry |
| `NFR-OBS-005` | Alerts | AlertManager → PagerDuty/Slack |
| `NFR-OBS-006` | Health checks | Uptime Kuma (external) |
| `NFR-OBS-007` | SLI/SLO/SLA | Defined + error budget |

### 8.1 Monitoring KPIs

| KPI | Target |
|---|---|
| Uptime | ≥ 99.9% |
| API p95 latency | < 500 ms |
| API error rate | < 0.1% |
| Sync success rate | ≥ 99.5% |
| DB query p95 | < 100 ms |
| Background jobs success | ≥ 99% |

---

## 9. Compliance & Data Governance Requirements

| ID | Requirement | Target |
|---|---|---|
| `NFR-CMP-001` | Data retention | Assets: permanent; Audit: 7 years; Inventory: 5 years |
| `NFR-CMP-002` | Archiving | Retired assets → cold archive after 1 year |
| `NFR-CMP-003` | Soft delete | Every delete = is_active=false |
| `NFR-CMP-004` | PII handling | Confidential → encrypt + limited access |
| `NFR-CMP-005` | GDPR-ready | Right-to-erasure mode |
| `NFR-CMP-006` | Audit immutability | Append-only, non-modifiable |

---

## 10. Operational Requirements

### 10.1 Incident & Escalation (AAB §11Q)

| Priority | Response | Resolution | Notify |
|---|---|---|---|
| P1 | 15 min | 2 h | CTO + On-Call |
| P2 | 1 h | 8 h | Team Lead |
| P3 | 4 h | 3 days | Developer |
| P4 | 24 h | 2 weeks | Backlog |

### 10.2 Backup (ADR-007)

| Type | Frequency | Retention |
|---|---|---|
| Full | Weekly | 4 weeks |
| Incremental | Daily | 30 days |
| WAL (continuous) | Continuous | 7 days |
| Snapshot | Every 6 h | 1 week |
| Archive | Monthly | 1 year+ |

---

## 11. NFR Traceability

- Each NFR is linked to a test type in the **Test Strategy** and to monitoring in **Operations**.
- NFR performance targets are validated via k6 load/stress/soak/spike tests.
- Availability targets are verified via monitoring dashboards.

---

## 12. References

| Reference | Location |
|---|---|
| AAB v6.0 | AssetX-Architecture-Bible/ |
| Test Strategy | Testing/Test_Strategy.md |
| Security Architecture | Security/Security_Architecture.md |
| Operations Manual | Operations/Operations_Manual.md |

---

## 13. Document Control (Closure)

| Field | Value |
|---|---|
| **Status** | Approved Baseline |
| **Approved By** | CAB |

> **End of NFR.**
