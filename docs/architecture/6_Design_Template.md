# 6. Design Template

> **Version:** 1.0 | **Status:** Approved | **Owner:** Technical Leads / ARB
> **Last Updated:** 2026-08-03 | **Review Cycle:** As needed

This is the **standard technical design document template**. Copy it for each feature design, after the ADR is accepted.

---

```markdown
# [Feature Name] — Design Document

> **References:** RFC-XXX, ADR-XXX
> **Version:** 1.0 | **Status:** Draft | Approved
> **Owner:** [Lead]

---

## Business Requirements
[User-facing need; persona; value.]

## Functional Requirements
[Numbered functional requirements (FR-n). Testable.]

## Non-Functional Requirements
[Performance, security, availability, scalability targets (NFR-n).]

## Architecture
[How the feature fits the system; layers touched; diagram (Mermaid).]

## Sequence Diagram
[Key interaction flow (Mermaid sequenceDiagram).]

## ERD (if data)
[Entity-relationship changes (Mermaid erDiagram).]

## API
[Endpoints, methods, request/response, permissions.]

## Permissions
[Which permissions; how enforced; matrix.]

## Validation
[Input validation rules and error codes.]

## Failure Cases
[How failures are handled; partial failure; retries.]

## Performance
[Expected latency/throughput; indexes; caching; streaming.]

## Monitoring
[Metrics, logs, alerts to add.]

## Testing
[Unit/integration/e2e strategy; scenarios.]

## Deployment
[Migration, feature flag, rollout steps.]

## Acceptance Criteria
[Checklist that defines Done.]
```

---

## Guidance

- Reference the implementing **RFC** and **ADR** at the top.
- Produce **Technical Design** then **Business Design** (per governance), both referencing the ADR.
- Include Mermaid diagrams for sequence/ERD/flow.
- Keep it **implementation-ready**: engineers/AI agents can build without assumptions.

## Mandatory sections

**Business Requirements, Functional Requirements, Non-Functional Requirements, Architecture, Sequence Diagram, ERD (if data), API, Permissions, Validation, Failure Cases, Performance, Monitoring, Testing, Deployment, Acceptance Criteria.**

## Anti-patterns

- Design with no FR/NFR (untestable).
- Design that contradicts the ADR.
- Missing failure cases and rollback.
