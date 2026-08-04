/**
 * LifecycleEventSubscriber — non-invasive bridge (Task L2).
 * Listens to existing domain events (ASSET_CREATED, ASSET_STATUS_CHANGED,
 * MOVEMENT_APPROVED), derives the CURRENT lifecycle state via L1, reconstructs
 * the PREVIOUS state, and publishes a Lifecycle Event ONLY when the derived
 * state actually changed. It modifies NO existing service.
 *
 * Flow:
 *   Existing Domain Event → Lifecycle Subscriber → L1 State Machine
 *     → Compare Previous / Current State → Publish Lifecycle Event if changed.
 *
 * The subscriber keeps a lightweight in-memory previous-state tracker keyed by
 * (tenant:assetId) to compare previous vs current. It is NOT persistent (no
 * schema change in L2); a durable read model is deferred (Technical Debt).
 * Reference: Task L2 — Epic L.
 */
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../core/events/event-bus';
import { DOMAIN_EVENTS, DomainEvent } from '../../core/events/event-types';
import { EVENT_BUS } from '../../core/ports/tokens';
import { LifecycleStateId } from '../../core/entities/lifecycle.entity';
import { MovementType } from '../../core/entities/movement.entity';
import { AssetLifecycleSnapshotAdapter } from './asset-lifecycle-snapshot.adapter';
import { AssetLifecycleStateMachineService } from '../lifecycle-state-machine.service';
import { LifecycleEventService } from './lifecycle-event.service';

@Injectable()
export class LifecycleEventSubscriber implements OnModuleInit {
  /** in-memory previous-state tracker (tenant:assetId → last derived state) */
  private readonly previousStates = new Map<string, LifecycleStateId>();

  constructor(
    @Inject(EVENT_BUS) private readonly bus: EventBus,
    private readonly lifecycle: AssetLifecycleStateMachineService,
    private readonly adapter: AssetLifecycleSnapshotAdapter,
    private readonly events: LifecycleEventService,
  ) {}

  onModuleInit(): void {
    this.bus.subscribe(DOMAIN_EVENTS.ASSET_CREATED, (e) => void this.onAssetCreated(e));
    this.bus.subscribe(DOMAIN_EVENTS.ASSET_STATUS_CHANGED, (e) => void this.onStatusChanged(e));
    this.bus.subscribe(DOMAIN_EVENTS.MOVEMENT_APPROVED, (e) => void this.onMovementApproved(e));
  }

  private key(tenant: string, assetId: string): string {
    return `${tenant}:${assetId}`;
  }

  private async currentState(tenant: string, assetId: string): Promise<LifecycleStateId> {
    const snapshot = await this.adapter.fromAssetId(assetId, tenant);
    return this.lifecycle.getCurrentState(snapshot);
  }

  private async onAssetCreated(e: DomainEvent): Promise<void> {
    try {
      const assetId = e.entityId;
      if (!assetId) return;
      const current = await this.currentState(e.tenant_id, assetId);
      // A newly created asset is registered from draft.
      this.events.publishTransition(e.tenant_id, assetId, 'draft', current, e.userId);
      this.previousStates.set(this.key(e.tenant_id, assetId), current);
    } catch { /* subscriber must never crash on a handler error */ }
  }

  private async onStatusChanged(e: DomainEvent): Promise<void> {
    try {
      const assetId = e.entityId;
      if (!assetId) return;
      const current = await this.currentState(e.tenant_id, assetId);
      const previous = this.previousStates.get(this.key(e.tenant_id, assetId)) ?? current;
      // Status changes do not change the derived lifecycle state → previous===current → no event.
      this.events.publishTransition(e.tenant_id, assetId, previous, current, e.userId);
      this.previousStates.set(this.key(e.tenant_id, assetId), current);
    } catch { /* subscriber must never crash on a handler error */ }
  }

  private async onMovementApproved(e: DomainEvent): Promise<void> {
    try {
      const payload = e.payload as { asset_name?: string; movement_type?: MovementType } | undefined;
      // MOVEMENT_APPROVED entityId = movement id; the asset id lives in payload.asset_name
      const assetId = payload?.asset_name ?? e.entityId;
      if (!assetId) return;
      const current = await this.currentState(e.tenant_id, assetId);
      const previous = this.previousStates.get(this.key(e.tenant_id, assetId))
        ?? this.reconstructPrevious(payload?.movement_type, current);
      this.events.publishTransition(e.tenant_id, assetId, previous, current, e.userId);
      this.previousStates.set(this.key(e.tenant_id, assetId), current);
    } catch { /* subscriber must never crash on a handler error */ }
  }

  /** Expected pre-movement state (fallback when no tracked previous state). */
  private reconstructPrevious(movementType: MovementType | undefined, current: LifecycleStateId): LifecycleStateId {
    switch (movementType) {
      case 'assignment': return 'active';
      case 'transfer': return 'active';
      case 'disposal': return 'active';
      case 'retirement': return 'active';
      case 'maintenance_return': return 'in_maintenance';
      case 'return': return 'assigned';
      default: return current;
    }
  }
}
