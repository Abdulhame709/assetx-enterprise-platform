# ADR-007 — Extend Asset Movement Lifecycle

**Status:** Approved
**Date:** 2026-08-03
**Deciders:** Senior Enterprise Solution Architect, Technical Program Manager, Product Owner
**Related:** ADR-001 (UUID) · ADR-004 (RLS) · Entity Spec §5.12 (AssetMovement) · Data Dictionary TB-MOVEMENT

---

## Context

The existing `asset_movements` table was designed to record **historical movements only** — three enum values (`transfer`, `disposal`, `retirement`) with no approval workflow. The enterprise Asset Management system requires a full **asset movement & lifecycle module** supporting:

- Transfer (location change)
- Assignment (employee custody)
- Return (from employee)
- Maintenance return
- Disposal
- Retirement

and an **approval lifecycle** (pending → approved / rejected) with the property that **assets are only mutated after a movement is approved**.

The current schema cannot represent the additional movement types (missing enum values) nor the approval state (missing `status` / `approved_at` columns). Adding a separate approval table was rejected in favor of keeping the movement lifecycle in its natural entity.

## Decision

Extend the existing schema via a **new migration** (`002_movement_lifecycle.sql`) — no new tables:

1. **Extend `movement_type` enum** (6 values):
   - `assignment`, `return`, `maintenance_return` added to the existing `transfer`, `disposal`, `retirement`.

2. **Add approval lifecycle columns** to `asset_movements`:
   - `status TEXT NOT NULL DEFAULT 'pending'`
   - `approved_at TIMESTAMPTZ`

3. **Constrain status values**:
   - `CHECK (status IN ('pending','approved','rejected'))`

## Consequences

**Positive**
- Full movement lifecycle supported without a new table (audit trail + reporting stay in one entity).
- Asset mutations happen only on approval (data integrity).
- Backward compatible — existing `transfer`/`disposal`/`retirement` records remain valid.

**Negative / trade-offs**
- First schema modification since project start — tracked here as an approved ADR.
- `status` is a constrained TEXT (kept simple); a Postgres `enum` could be used later if needed.
- Existing API clients must account for the `pending` state on new movements.

## Verification

Covered by the movement integration/E2E test suites:
- All 6 movement types create a `pending` record (BR-MOV-001).
- Approve applies asset change (BR-MOV-002); reject does not.
- Critical lifecycle (disposal/retirement) follows the same approval path (BR-MOV-005).
- Disposed assets cannot return to active (BR-MOV-004).
- 65 backend tests pass overall.
