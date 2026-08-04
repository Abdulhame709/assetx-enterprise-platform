/**
 * LifecycleStateConfig — configurable lifecycle states and transition rules.
 * Data only (no logic, no SQL). Keeps the business rules OUT of controllers and
 * OUT of the state machine service; the service only consumes this config.
 * Follows the pattern of INTEGRITY_WEIGHTS (Epic E-2). Adjustable without code
 * changes to consumers. Reference: Task L1 — Epic L.
 */
import {
  LifecycleState,
  LifecycleStateId,
  LifecycleTransitionRule,
} from '../../core/entities/lifecycle.entity';

export const DEFAULT_LIFECYCLE_STATES: Record<LifecycleStateId, LifecycleState> = {
  draft: { id: 'draft', name: 'Draft', description: 'Asset created but not yet registered/activated.', category: 'pending', terminal: false },
  registered: { id: 'registered', name: 'Registered', description: 'Asset formally registered, active, never moved.', category: 'operational', terminal: false },
  active: { id: 'active', name: 'Active', description: 'Asset operational, no custody, has movement history.', category: 'operational', terminal: false },
  assigned: { id: 'assigned', name: 'Assigned', description: 'Asset under employee custody (employee_id set).', category: 'operational', terminal: false },
  in_maintenance: { id: 'in_maintenance', name: 'In Maintenance', description: 'Asset in a maintenance flow (maintenance_return movement).', category: 'maintenance', terminal: false },
  transferred: { id: 'transferred', name: 'Transferred', description: 'Asset moved to a different location via approved transfer.', category: 'operational', terminal: false },
  disposed: { id: 'disposed', name: 'Disposed', description: 'Terminal — asset disposed; no return (BR-MOV-004).', category: 'terminal', terminal: true },
  archived: { id: 'archived', name: 'Archived', description: 'Terminal — asset archived/retired out of service.', category: 'terminal', terminal: true },
};

/** Allowed transition edges (source → target). Terminal states have no outgoing edges. */
export const DEFAULT_LIFECYCLE_TRANSITIONS: LifecycleTransitionRule[] = [
  { from: 'draft', to: 'registered', reason: 'Draft is formally registered.' },
  { from: 'draft', to: 'disposed', reason: 'Draft discarded before activation.' },
  { from: 'registered', to: 'active', reason: 'Registered asset activated into operations.' },
  { from: 'registered', to: 'disposed', reason: 'Disposed before going active.' },
  { from: 'registered', to: 'archived', reason: 'Archived before going active.' },
  { from: 'active', to: 'assigned', reason: 'Asset placed under custody.' },
  { from: 'active', to: 'in_maintenance', reason: 'Asset enters maintenance.' },
  { from: 'active', to: 'transferred', reason: 'Asset transferred between locations.' },
  { from: 'active', to: 'disposed', reason: 'Asset disposed.' },
  { from: 'active', to: 'archived', reason: 'Asset archived.' },
  { from: 'assigned', to: 'active', reason: 'Custody returned (asset back to active).' },
  { from: 'assigned', to: 'in_maintenance', reason: 'Custody asset enters maintenance.' },
  { from: 'assigned', to: 'transferred', reason: 'Custody asset transferred.' },
  { from: 'assigned', to: 'disposed', reason: 'Custody asset disposed.' },
  { from: 'assigned', to: 'archived', reason: 'Custody asset archived.' },
  { from: 'in_maintenance', to: 'active', reason: 'Maintenance complete, asset active.' },
  { from: 'in_maintenance', to: 'assigned', reason: 'Maintenance complete, asset reassigned.' },
  { from: 'in_maintenance', to: 'disposed', reason: 'Asset disposed while in maintenance.' },
  { from: 'in_maintenance', to: 'archived', reason: 'Asset archived while in maintenance.' },
  { from: 'transferred', to: 'active', reason: 'Transfer settled, asset active in new location.' },
  { from: 'transferred', to: 'assigned', reason: 'Transferred asset placed under custody.' },
  { from: 'transferred', to: 'in_maintenance', reason: 'Transferred asset enters maintenance.' },
  { from: 'transferred', to: 'disposed', reason: 'Transferred asset disposed.' },
  { from: 'transferred', to: 'archived', reason: 'Transferred asset archived.' },
  // disposed / archived → none (terminal)
];

export class LifecycleStateConfig {
  private readonly byId: Record<LifecycleStateId, LifecycleState>;
  private readonly rules: LifecycleTransitionRule[];

  constructor(
    states: Record<LifecycleStateId, LifecycleState> = DEFAULT_LIFECYCLE_STATES,
    rules: LifecycleTransitionRule[] = DEFAULT_LIFECYCLE_TRANSITIONS,
  ) {
    this.byId = states;
    this.rules = rules;
  }

  getState(id: LifecycleStateId): LifecycleState {
    const s = this.byId[id];
    if (!s) throw new Error('UNKNOWN_LIFECYCLE_STATE');
    return s;
  }

  getStates(): LifecycleState[] {
    return Object.values(this.byId);
  }

  getAllowedTransitions(from: LifecycleStateId): LifecycleTransitionRule[] {
    return this.rules.filter((r) => r.from === from);
  }

  canTransition(from: LifecycleStateId, to: LifecycleStateId): boolean {
    return this.rules.some((r) => r.from === from && r.to === to);
  }
}
