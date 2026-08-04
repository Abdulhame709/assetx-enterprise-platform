/**
 * LifecyclePort — contract for the Asset Lifecycle State Machine (Task L1).
 * Exposes derived-state intelligence and transition validation/evaluation.
 * Deliberately has NO mutation, NO persistence and NO workflow execution.
 * Reference: Task L1 — Epic L.
 */
import {
  AssetLifecycleSnapshot,
  LifecycleState,
  LifecycleStateId,
  LifecycleTransitionDecision,
  LifecycleTransitionEvaluation,
  LifecycleTransitionRule,
} from '../entities/lifecycle.entity';

export interface LifecyclePort {
  /** Derive the current lifecycle state from existing signals (no storage). */
  getCurrentState(snapshot: AssetLifecycleSnapshot): LifecycleStateId;

  /** Pure check whether a from→to transition is allowed by the rules. */
  validateTransition(from: LifecycleStateId, to: LifecycleStateId): LifecycleTransitionDecision;

  /** Derive current state, validate a target, return the evaluation. */
  evaluateTransition(snapshot: AssetLifecycleSnapshot, target: LifecycleStateId): LifecycleTransitionEvaluation;

  /** All allowed target states from a given source state. */
  getAllowedTransitions(from: LifecycleStateId): LifecycleTransitionRule[];

  getState(stateId: LifecycleStateId): LifecycleState;

  getStates(): LifecycleState[];
}
