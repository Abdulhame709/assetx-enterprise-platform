import type { PendingInventoryMutation } from "./domain";
import { syncCycle } from "./api";
import { listPendingMutations, markMutationConflict, markMutationSynced, registerMutationFailure } from "./offline-store";

export interface SyncSummary { synced: number; conflicts: number; pending: number; errors: number; }
export async function syncPendingInventory(): Promise<SyncSummary> {
  const byCycle = new Map<string, PendingInventoryMutation[]>(); for (const mutation of await listPendingMutations()) byCycle.set(mutation.cycle_id, [...(byCycle.get(mutation.cycle_id) ?? []), mutation]);
  const summary: SyncSummary = { synced: 0, conflicts: 0, pending: 0, errors: 0 };
  for (const [cycleId, mutations] of byCycle) for (let index = 0; index < mutations.length; index += 100) { const batch = mutations.slice(index, index + 100); try { const results = await syncCycle(cycleId, batch); const resultById = new Map(results.map((result) => [result.mutation_id, result])); for (const mutation of batch) { const result = resultById.get(mutation.id); if (result?.status === "synced") { await markMutationSynced(mutation.id, mutation.record_id, cycleId, result.updated_at); summary.synced += 1; } else if (result?.status === "conflict") { await markMutationConflict(mutation.id, mutation.record_id, cycleId); summary.conflicts += 1; } else { const failed = await registerMutationFailure(mutation.id, result?.code); if (failed && failed.attempts >= 3) { await markMutationConflict(mutation.id, mutation.record_id, cycleId); summary.conflicts += 1; } else { summary.pending += 1; summary.errors += 1; } } } } catch { for (const mutation of batch) { const failed = await registerMutationFailure(mutation.id, "NETWORK_REQUEST_FAILED"); if (failed && failed.attempts >= 3) { await markMutationConflict(mutation.id, mutation.record_id, cycleId); summary.conflicts += 1; } else { summary.pending += 1; summary.errors += 1; } } } }
  return summary;
}
