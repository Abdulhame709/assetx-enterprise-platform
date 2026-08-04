/**
 * Lifecycle domain entities — Asset Lifecycle State Machine (Task L1).
 * Derived-state intelligence ONLY (no persistence, no workflow execution).
 * A lifecycle state is a stable, domain-level interpretation of the asset's
 * existing fields (is_active, employee_id) plus the latest approved movement.
 * No lifecycle_state column, no new table, no schema change.
 * Reference: Task L1 — Epic L (Asset Lifecycle Management).
 */
import { MovementType } from './movement.entity';

export type LifecycleStateId =
  | 'draft'
  | 'registered'
  | 'active'
  | 'assigned'
  | 'in_maintenance'
  | 'transferred'
  | 'disposed'
  | 'archived';

export type LifecycleStateCategory =
  | 'pending'      // draft
  | 'operational'  // registered, active, assigned, transferred
  | 'maintenance'  // in_maintenance
  | 'terminal';    // disposed, archived

export interface LifecycleState {
  id: LifecycleStateId;
  name: string;
  description: string;
  category: LifecycleStateCategory;
  /** terminal states cannot transition out */
  terminal: boolean;
}

/**
 * Snapshot of the existing signals used to DERIVE the current state.
 * Intentionally excludes created_at (removed from decision logic per design
 * review) and status_id (cosmetic, tenant-defined, not relied upon).
 */
export interface AssetLifecycleSnapshot {
  isActive: boolean;
  employeeId: string | null;
  /** type of the latest APPROVED movement for the asset (null if none) */
  latestMovementType: MovementType | null;
}

/** A single allowed transition edge (from → to). */
export interface LifecycleTransitionRule {
  from: LifecycleStateId;
  to: LifecycleStateId;
  reason: string;
}

/** Result of validateTransition — a pure check of a transition edge. */
export interface LifecycleTransitionDecision {
  allowed: boolean;
  from: LifecycleStateId;
  to: LifecycleStateId;
  /** reason for allow/disallow */
  reason?: string;
}

/** Result of evaluateTransition — derive current state, then evaluate a target. */
export interface LifecycleTransitionEvaluation {
  allowed: boolean;
  from: LifecycleStateId;
  to: LifecycleStateId;
  reason?: string;
  /** resulting state if the transition is allowed, otherwise undefined */
  resultingState?: LifecycleStateId;
}

export const LIFECYCLE_ERRORS = {
  UNKNOWN_STATE: 'UNKNOWN_LIFECYCLE_STATE',
  INVALID_TRANSITION: 'INVALID_LIFECYCLE_TRANSITION',
} as const;
