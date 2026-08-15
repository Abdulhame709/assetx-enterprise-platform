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
} from './api';

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
      return { cycle, summary, records: enrichRecords(records, lookups), lookups, locationSuggestions };
    },
    [id],
  );
}
