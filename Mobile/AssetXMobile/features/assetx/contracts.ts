import type { PendingInventoryMutation } from "./domain";

/** Maps local queued work to the exact tenant-scoped backend sync contract. */
export function toInventorySyncRequest(mutations: PendingInventoryMutation[]) {
  return {
    mutations: mutations.map((mutation) => ({
      mutation_id: mutation.id,
      record_id: mutation.record_id,
      asset_id: mutation.asset_id,
      mode: mutation.mode,
      base_updated_at: mutation.base_updated_at,
      payload: mutation.payload,
    })),
  };
}
