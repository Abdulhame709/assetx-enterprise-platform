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

/** Load reference names (categories/locations) for human-readable display. */
function useNames(): NameLookup {
  return useAsync<NameLookup>(() => getReferenceNames(), []).data ?? { categories: new Map(), locations: new Map(), employees: new Map(), statuses: new Map() };
}

/** Load analytics summary. */
export function useAnalytics(): AsyncState<AssetAnalyticsSummary> {
  return useAsync<AssetAnalyticsSummary>(() => getAnalyticsSummary(), []);
}

/** Load paged asset list with filters. */
export function useAssetList(query: AssetQuery): AsyncState<{ items: AssetSummary[]; total: number }> {
  const names = useNames();
  return useAsync(
    () => searchAssets(query, undefined, names),
    [query, names],
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
