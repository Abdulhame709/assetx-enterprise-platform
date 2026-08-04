# 4. ADR Template

> **Version:** 1.0 | **Status:** Approved | **Owner:** ARB
> **Last Updated:** 2026-08-03 | **Review Cycle:** As needed

This is the **official Architecture Decision Record template**. Copy this file for each new ADR. Every ADR is stored at `db/ADR-XXX_short-title.md`.

---

```markdown
# ADR-XXX — [Short Title]

**Status:** Proposed | Accepted | Superseded | Rejected
**Date:** YYYY-MM-DD
**Deciders:** ARB, [other deciders]
**Related:** [linked ADRs / RFCs / docs]

---

## Status
[Proposed / Accepted / Superseded-by-XXX / Rejected — one line]

## Context
[The problem and background. Facts, constraints, existing decisions. Why now.]

## Decision
[The chosen option, stated clearly and concisely. What we will do.]

## Alternatives
[≥ 2 options considered, with trade-offs and why each was/wasn't chosen.]

## Consequences
[Positive and negative consequences. What changes for consumers/operators.]

## Migration
[DB/schema/code migration steps. New tables/columns. Versioning. Data migration.]

## Security
[Security impact: tenant isolation, permissions, auth, audit. Any new RLS.]

## Performance
[Performance impact: indexes, query plans, latency, scalability considerations.]

## Testing
[How the decision is verified: unit/integration/e2e tests. Test strategy.]

## Rollback
[How to undo the decision/migration safely. Forward + inverse steps.]

## Approval
| Approver | Role | Date | Outcome |
|---|---|---|---|
| | | | Approved / Rejected |
```

---

## ADR numbering

- ADRs are numbered sequentially: `ADR-001 … ADR-015+`.
- Filename: `ADR-XXX_<kebab-case-title>.md`.
- Reference the ADR in code comments and related docs.

## Mandatory sections

Every ADR MUST include: **Status, Context, Decision, Alternatives, Consequences, Migration, Security, Performance, Testing, Rollback, Approval.**

## Anti-patterns

- ADR that decides without alternatives.
- ADR written after implementation (post-hoc) without approval.
- Schema change ADR without a migration + rollback.
