/**
 * LifecycleReadService — read-only facade for the Asset 360 Lifecycle tab
 * (Phase P2). Composes the existing L1 state machine + snapshot adapter to
 * expose current state and allowed transitions for an asset. No persistence,
 * no mutation, no schema change, no modification to AssetService/MovementService.
 */
import { Injectable } from '@nestjs/common';
import { AssetLifecycleStateMachineService } from './lifecycle-state-machine.service';
import { AssetLifecycleSnapshotAdapter } from './lifecycle/asset-lifecycle-snapshot.adapter';
import { LifecycleTransitionsDto } from '../api/dto/lifecycle.dto';

@Injectable()
export class LifecycleReadService {
  constructor(
    private readonly lifecycle: AssetLifecycleStateMachineService,
    private readonly adapter: AssetLifecycleSnapshotAdapter,
  ) {}

  /** Current derived state for an asset. Throws ASSET_NOT_FOUND if absent. */
  async getState(assetId: string, tenantId: string): Promise<{ assetId: string; state: string; timestamp: string }> {
    const snapshot = await this.adapter.fromAssetId(assetId, tenantId);
    const state = this.lifecycle.getCurrentState(snapshot);
    return { assetId, state, timestamp: new Date().toISOString() };
  }

  /** Current state + allowed transitions for an asset. */
  async getTransitions(assetId: string, tenantId: string): Promise<LifecycleTransitionsDto> {
    const snapshot = await this.adapter.fromAssetId(assetId, tenantId);
    const state = this.lifecycle.getCurrentState(snapshot);
    const allowedTransitions = this.lifecycle.getAllowedTransitions(state);
    return { assetId, state, allowedTransitions };
  }
}
