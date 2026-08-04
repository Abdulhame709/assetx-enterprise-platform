/**
 * AssetLifecycleStateMachineService — derived-state intelligence (Task L1).
 * Pure derivation + transition validation/evaluation. NO persistence, NO
 * workflow execution, NO mutation of assets, NO events. Uses only the existing
 * signals in AssetLifecycleSnapshot. No hardcoded business rules here — the
 * states/transitions live in LifecycleStateConfig.
 *
 * Derivation priority (per approved design review):
 *   disposed → archived → in_maintenance → transferred → assigned
 *   → registered → active → draft
 * created_at and status_id are intentionally NOT used.
 * Reference: Task L1 — Epic L.
 */
import { Injectable } from '@nestjs/common';
import { LifecyclePort } from '../core/ports/lifecycle.port';
import {
  AssetLifecycleSnapshot,
  LifecycleState,
  LifecycleStateId,
  LifecycleTransitionDecision,
  LifecycleTransitionEvaluation,
  LifecycleTransitionRule,
  LIFECYCLE_ERRORS,
} from '../core/entities/lifecycle.entity';
import { LifecycleStateConfig } from './lifecycle/lifecycle-state.config';

/** Pure function: derive the current lifecycle state from existing signals. */
export function deriveLifecycleState(snapshot: AssetLifecycleSnapshot): LifecycleStateId {
  // 1 · disposed — inactive + disposal movement
  if (!snapshot.isActive && snapshot.latestMovementType === 'disposal') return 'disposed';
  // 2 · archived — any other inactive asset
  if (!snapshot.isActive) return 'archived';
  // 3 · in_maintenance — maintenance flow active
  if (snapshot.latestMovementType === 'maintenance_return') return 'in_maintenance';
  // 4 · transferred — approved transfer
  if (snapshot.latestMovementType === 'transfer') return 'transferred';
  // 5 · assigned — employee custody
  if (snapshot.employeeId) return 'assigned';
  // 6 · registered — active, never moved
  if (snapshot.isActive && snapshot.latestMovementType === null) return 'registered';
  // 7 · active — active with movement history not covered above
  if (snapshot.isActive) return 'active';
  // 8 · draft — default fallback
  return 'draft';
}

@Injectable()
export class AssetLifecycleStateMachineService implements LifecyclePort {
  constructor(private readonly config: LifecycleStateConfig) {}

  getCurrentState(snapshot: AssetLifecycleSnapshot): LifecycleStateId {
    return deriveLifecycleState(snapshot);
  }

  validateTransition(from: LifecycleStateId, to: LifecycleStateId): LifecycleTransitionDecision {
    const allowed = this.config.canTransition(from, to);
    return {
      allowed,
      from,
      to,
      reason: allowed ? undefined : LIFECYCLE_ERRORS.INVALID_TRANSITION,
    };
  }

  evaluateTransition(snapshot: AssetLifecycleSnapshot, target: LifecycleStateId): LifecycleTransitionEvaluation {
    const current = deriveLifecycleState(snapshot);
    const decision = this.validateTransition(current, target);
    return {
      ...decision,
      resultingState: decision.allowed ? target : undefined,
    };
  }

  getAllowedTransitions(from: LifecycleStateId): LifecycleTransitionRule[] {
    return this.config.getAllowedTransitions(from);
  }

  getState(stateId: LifecycleStateId): LifecycleState {
    return this.config.getState(stateId);
  }

  getStates(): LifecycleState[] {
    return this.config.getStates();
  }
}
