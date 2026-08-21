'use client';

import { useAsync, AsyncState } from '@/lib/use-async';
import {
  getCycles,
  getSummary,
  getCycle,
  getRecords,
  getInventoryLookups,
  getLocationSuggestions,
  enrichRecords,
  InventoryCycle,
  CycleSummary,
  InventoryRecordRow,
  InventoryLookups,
  LocationInventorySuggestion,
  InventoryResult,
} from './api';
import { getStoredSnapshot } from './offline-store';

/** Cycle + its computed summary for list rows. */
export interface CycleWithSummary {
  cycle: InventoryCycle;
  summary: CycleSummary | null;
}

/** Load all cycles with their summaries (parallel; failures degrade, never hide the cycle). */
export function useCycles(): AsyncState<CycleWithSummary[]> {
  return useAsync<CycleWithSummary[]>(
    async () => {
      const cycles = await getCycles();
      const summaries = await Promise.all(
        cycles.map((c) => getSummary(c.id).catch(() => null)),
      );
      return cycles.map((cycle, i) => ({ cycle, summary: summaries[i] ?? null }));
    },
    [],
    { isEmpty: (d) => d.length === 0 },
  );
}

export interface CycleDetailData {
  cycle: InventoryCycle;
  summary: CycleSummary | null;
  records: InventoryRecordRow[];
  lookups: InventoryLookups;
  locationSuggestions: LocationInventorySuggestion[];
}

/** Match the database view's result classification for a locally changed row. */
function deriveLocalResult(
  expectedQuantity: number | null,
  actualQuantity: number | null,
  expectedLocationId: string | null,
  actualLocationId: string | null,
): InventoryResult {
  if (actualQuantity == null) return 'not_inventoried';
  if (actualQuantity === 0) return 'missing';
  if (expectedQuantity != null && actualQuantity < expectedQuantity) return 'deficit';
  if (expectedQuantity != null && actualQuantity > expectedQuantity) return 'surplus';
  if (actualLocationId !== expectedLocationId) return 'transferred';
  return 'matched';
}

/** Overlay only the local field snapshot state; server data remains authoritative after sync. */
export function mergeStoredRecords(id: string, records: InventoryRecordRow[]): InventoryRecordRow[] {
  const snapshot = getStoredSnapshot(id);
  if (!snapshot) return records;
  const byId = new Map(snapshot.records.map((record) => [record.record_id, record]));
  return records.map((record) => {
    const local = byId.get(record.id);
    if (!local) return record;
    return {
      ...record,
      actual_location_id: local.actual_location_id,
      actual_quantity: local.actual_quantity,
      actual_status_id: local.actual_status_id,
      actual_employee_id: local.actual_employee_id,
      inventory_date: local.inventory_date,
      notes: local.notes,
      is_verified: local.is_verified,
      result: deriveLocalResult(
        record.expected_quantity,
        local.actual_quantity,
        record.expected_location_id,
        local.actual_location_id,
      ),
      updated_at: local.updated_at,
      sync_state: local.sync_state,
    };
  });
}

/** Full cycle detail: cycle + summary + enriched records + reference lookups. */
export function useCycleDetail(id: string): AsyncState<CycleDetailData> {
  return useAsync<CycleDetailData>(
    async () => {
      const [cycle, summary, records, lookups, locationSuggestions] = await Promise.all([
        getCycle(id),
        getSummary(id).catch(() => null),
        getRecords(id),
        getInventoryLookups(),
        getLocationSuggestions(id),
      ]);
      if (!cycle) throw new Error('CYCLE_NOT_FOUND');
      const mergedRecords = mergeStoredRecords(id, records);
      return { cycle, summary, records: enrichRecords(mergedRecords, lookups), lookups, locationSuggestions };
    },
    [id],
  );
}
