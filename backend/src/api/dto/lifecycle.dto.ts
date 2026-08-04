/**
 * Lifecycle read API DTOs (Phase P2).
 * Read-only responses for the Asset 360 Lifecycle tab. Uses the existing L1
 * state machine; no database changes, no migrations, no AssetService change.
 */
import { LifecycleStateId, LifecycleTransitionRule } from '../../core/entities/lifecycle.entity';

export interface LifecycleStateDto {
  assetId: string;
  state: LifecycleStateId;
  timestamp: string;
}

export interface LifecycleTransitionsDto {
  assetId: string;
  state: LifecycleStateId;
  allowedTransitions: LifecycleTransitionRule[];
}
