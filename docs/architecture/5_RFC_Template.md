# 5. RFC Template

> **Version:** 1.0 | **Status:** Approved | **Owner:** ARB
> **Last Updated:** 2026-08-03 | **Review Cycle:** As needed

This is the **official Request For Comments template**. Copy it for each new RFC. RFCs live in `docs/rfc/RFC-XXX-short-title.md`.

---

```markdown
# RFC-XXX — [Short Title]

> **Project:** AssetX
> **RFC #:** XXX
> **Title:** [Title]
> **Status:** 🔎 Proposed (Open for comment) | Accepted | Rejected | Deferred
> **Date:** YYYY-MM-DD
> **Author:** [Name]
> **Reviewers:** [ARB, PO, TPM, Security, Frontend, ...]

---

## Motivation
[Why do we need this? The problem and its impact.]

## Goals
[Must-have outcomes — measurable, specific.]

## Non-Goals
[Explicitly out of scope for this RFC — prevent scope creep.]

## Proposal
[The proposed solution at a high level. Architecture/diagram optional.]

## Alternatives
[≥ 2 alternatives considered, with trade-offs.]

## Compatibility
[Impact on existing APIs, data, clients, integrations. Backward compatibility.]

## Security
[Security implications: auth, permissions, tenant isolation, audit.]

## Migration
[Schema/data/code migration if any. Versioning.]

## Rollout
[How it is rolled out: feature flag, phased, environments, rollback.]

## Open Questions
[Questions for reviewers; decisions needed.]

## Approval
| Approver | Role | Date | Outcome |
|---|---|---|---|
| | | | |
```

---

## RFC lifecycle

1. **Proposed** — written, open for comment.
2. **Review** — comments gathered; produce an **RFC Review Summary** (decision, accepted/rejected/deferred items, risks, actions).
3. **Accepted/Rejected/Deferred** — outcome recorded; if accepted, write the ADR.

## RFC vs ADR

- **RFC:** discusses *whether* to build and *what the options are*.
- **ADR:** records the *final decision* after RFC acceptance.

## Mandatory sections

**Motivation, Goals, Non-Goals, Proposal, Alternatives, Compatibility, Security, Migration, Rollout, Open Questions, Approval.**

## Anti-patterns

- RFC that skips alternatives.
- RFC with no non-goals (scope creep).
- RFC that jumps straight to implementation without an ADR.
