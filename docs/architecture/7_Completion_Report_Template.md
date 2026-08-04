# 7. Completion Report Template

> **Version:** 1.0 | **Status:** Approved | **Owner:** Technical Lead / TPM
> **Last Updated:** 2026-08-03 | **Review Cycle:** Per phase/feature

This is the **mandatory implementation closure report** template. Produce one after each feature/phase. It is the permanent record of what was built and why.

---

```markdown
# [Phase/Feature] Completion Report

> **References:** RFC-XXX, ADR-XXX, Design Document
> **Version:** 1.0 | **Status:** Completed | **Date:** YYYY-MM-DD

---

## Executive Summary
[What was delivered and its value, in 2-4 sentences.]

## Implemented Scope
[What was actually built — features, modules, endpoints.]

## Files Changed
[New files + modified files with a one-line purpose each.]

## Architecture Impact
[How it fits/extends Clean Architecture; ports/providers added.]

## Security Review
[Auth, permissions, tenant isolation, audit, RLS — what was done and verified.]

## Performance Review
[Latency/throughput, indexes, streaming, caching.]

## Testing
[Test suites, counts, coverage highlights; all-green status.]

## Known Limitations
[Accepted trade-offs and current constraints.]

## Lessons Learned
[What to carry forward; what to avoid.]

## Future Work
[Deferred items → Technical Debt Register references.]
```

---

## Mandatory sections

**Executive Summary, Implemented Scope, Files Changed, Architecture Impact, Security Review, Performance Review, Testing, Known Limitations, Lessons Learned, Future Work.**

## Anti-patterns

- Report without a security review.
- Report claiming completion with failing tests.
- Hiding known limitations.
