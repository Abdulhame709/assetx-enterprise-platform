'use client';

import {
  AssetAnalyticsSummary,
  AssetDetail,
  AssetMovement,
  AssetQuery,
  AssetSummary,
  AuditEvent,
  LifecycleTransitions,
} from './types';
import {
  getAnalyticsSummary,
  getAsset,
  getAssetAudit,
  getAssetMovements,
  getLifecycleTransitions,
  getReferenceNames,
  searchAssets,
} from './api';
import { NameLookup } from './mappers';
import { useAsync, AsyncState } from '@/lib/use-async';

/**
 * STABILITY (P1 fix F-06 — /assets fetch storm): module-level empty lookup
 * keeps a stable identity while references load. Previously the `??` fallback
 * built new Map objects on EVERY render; pages also pass inline query objects
 * (new identity per render) → `[query, names]` changed every render → the
 * loading effect re-fired endlessly (measured: ~352 GET /assets in 8s,
 * skeleton never settling). Same stabilization pattern as useMovements.
 */
const EMPTY_LOOKUP: NameLookup = {
  categories: new Map(), locations: new Map(), employees: new Map(), statuses: new Map(),
};

/** Load reference names (categories/locations) for human-readable display. */
function useNames(): NameLookup {
  return useAsync<NameLookup>(() => getReferenceNames(), []).data ?? EMPTY_LOOKUP;
}

/** Load analytics summary. */
export function useAnalytics(): AsyncState<AssetAnalyticsSummary> {
  return useAsync<AssetAnalyticsSummary>(() => getAnalyticsSummary(), []);
}

/** Load paged asset list with filters. */
export function useAssetList(query: AssetQuery): AsyncState<{ items: AssetSummary[]; total: number }> {
  const names = useNames();
  const key = JSON.stringify(query);
  return useAsync(
    () => searchAssets(JSON.parse(key) as AssetQuery, undefined, names),
    [key, names],
    { isEmpty: (d) => d.items.length === 0 },
  );
}

/** Load Asset 360 data (detail + lifecycle + movements + audit). */
export function useAsset360(id: string): AsyncState<Asset360Data> {
  const names = useNames();
  return useAsync<Asset360Data>(
    async () => {
      const [d, lc, mv, au] = await Promise.all([
        getAsset(id, undefined, names),
        getLifecycleTransitions(id),
        getAssetMovements(id),
        getAssetAudit(id),
      ]);
      return { detail: d, lifecycle: lc, movements: mv, audit: au };
    },
    [id, names],
  );
}

export interface Asset360Data {
  detail: AssetDetail;
  lifecycle: LifecycleTransitions | null;
  movements: AssetMovement[];
  audit: AuditEvent[];
}
