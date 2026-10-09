import {
  syncInventoryMutations,
  InventorySyncResult,
} from './api';
import {
  incrementPendingInventoryMutationAttempts,
  listPendingInventoryMutations,
  markStoredRecordSyncState,
  removePendingInventoryMutation,
  StorageLike,
} from './offline-store';

export interface InventorySyncSummary {
  synced: number;
  conflicts: number;
  failed: number;
}

const MAX_SYNC_ATTEMPTS = 3;

function markFailure(
  cycleId: string,
  mutationId: string,
  recordId: string,
  storage: StorageLike | null,
  summary: InventorySyncSummary,
): void {
  const mutation = incrementPendingInventoryMutationAttempts(mutationId, storage);
  if (mutation && mutation.attempts >= MAX_SYNC_ATTEMPTS) {
    removePendingInventoryMutation(mutationId, storage);
    markStoredRecordSyncState(cycleId, recordId, 'conflict', storage);
    summary.conflicts += 1;
    return;
  }
  summary.failed += 1;
}

function applyResult(
  cycleId: string,
  result: InventorySyncResult,
  storage: StorageLike | null,
  summary: InventorySyncSummary,
): void {
  if (result.status === 'synced') {
    removePendingInventoryMutation(result.mutation_id, storage);
    markStoredRecordSyncState(cycleId, result.record_id, 'synced', storage, null, result.updated_at);
    summary.synced += 1;
    return;
  }

  if (result.status === 'conflict') {
    removePendingInventoryMutation(result.mutation_id, storage);
    markStoredRecordSyncState(cycleId, result.record_id, 'conflict', storage);
    summary.conflicts += 1;
    return;
  }

  markFailure(cycleId, result.mutation_id, result.record_id, storage, summary);
}

/**
 * Replays the local field-inventory queue through the guarded batch endpoint.
 * The backend compares each mutation's base_updated_at with the current row
 * version before applying it, so newer server data is never overwritten.
 */
export async function syncPendingInventoryMutations(
  cycleId: string,
  storage: StorageLike | null = typeof window === 'undefined' ? null : window.localStorage,
): Promise<InventorySyncSummary> {
  const pending = listPendingInventoryMutations(cycleId, storage);
  const summary: InventorySyncSummary = { synced: 0, conflicts: 0, failed: 0 };
  if (pending.length === 0) return summary;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    summary.failed = pending.length;
    return summary;
  }

  try {
    const results = await syncInventoryMutations(cycleId, pending);
    const byId = new Map(results.map((result) => [result.mutation_id, result]));
    for (const mutation of pending) {
      const result = byId.get(mutation.id);
      if (result) {
        applyResult(cycleId, result, storage, summary);
      } else {
        markFailure(cycleId, mutation.id, mutation.record_id, storage, summary);
      }
    }
  } catch {
    for (const mutation of pending) {
      markFailure(cycleId, mutation.id, mutation.record_id, storage, summary);
    }
  }

  return summary;
}
