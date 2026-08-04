# Risk Register — AssetX

> **Version:** 1.0 | **Status:** Living artifact | **Owner:** TPM
> **Last Updated:** 2026-08-03 | **Review:** Weekly

**Scale:** Likelihood (L) 1-5 · Impact (I) 1-5 · Score = L×I (1-25). High ≥ 13.

| ID | Risk | L | I | Score | Owner | Mitigation | Status |
|---|---|---|---|---|---|---|---|
| RK-01 | Offline inventory data loss | 3 | 5 | 15 | Mobile/Arch | Sync queue + conflict resolution | Open |
| RK-02 | Tenant compromise | 2 | 5 | 10 | SecOps | MFA + RLS + audit | Open |
| RK-03 | Backup failure / data loss | 2 | 5 | 10 | DevOps | Monthly restore test + PITR | Open |
| RK-04 | Scope creep / doc bloat | 4 | 3 | 12 | TPM/PO | Backlog + DoR gate; stop generic docs | Open (being controlled) |
| RK-05 | External service outage (Supabase/FCM/AI) | 3 | 3 | 9 | DevOps | Adapters + fallbacks | Open |
| RK-06 | Sync conflict complexity | 3 | 4 | 12 | Mobile/Arch | LWW + manual + conflict dashboard | Open |
| RK-07 | Performance at scale | 3 | 4 | 12 | Arch/DevOps | Indexes + caching + partitioning | Open |
| RK-08 | Team resource availability | 3 | 3 | 9 | TPM | Capacity planning + cross-training | Open |
| RK-09 | AI cost/accuracy | 3 | 3 | 9 | AI/Arch | Tiering + caching + batch | Open |
| RK-10 | Frontend effort underestimated | 3 | 4 | 12 | TPM | Phased web→mobile; reuse APIs | Open |
| RK-11 | Production migration (PGlite→Supabase) | 3 | 4 | 12 | DevOps | DatabasePort abstraction; dry-run | Open |
| RK-12 | Legacy data quality | 3 | 3 | 9 | Arch | 7-stage migration + cleansing | Open |
| RK-13 | ADR numbering inconsistency | 2 | 2 | 4 | Architect | Decision-log item to normalize | Open (low) |

## Rules

- High/critical risks escalated to CAB at phase gates.
- Review weekly; update likelihood/impact on material change.
