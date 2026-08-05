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
  searchAssets,
} from './api';
import { useAsync, AsyncState } from '@/lib/use-async';

/** Load analytics summary. */
export function useAnalytics(): AsyncState<AssetAnalyticsSummary> {
  return useAsync<AssetAnalyticsSummary>(() => getAnalyticsSummary(), []);
}

/** Load paged asset list with filters. */
export function useAssetList(query: AssetQuery): AsyncState<{ items: AssetSummary[]; total: number }> {
  return useAsync(() => searchAssets(query), [query], {
    isEmpty: (d) => d.items.length === 0,
  });
}

/** Load Asset 360 data (detail + lifecycle + movements + audit). */
export function useAsset360(id: string): AsyncState<Asset360Data> {
  return useAsync<Asset360Data>(
    async () => {
      const [d, lc, mv, au] = await Promise.all([
        getAsset(id),
        getLifecycleTransitions(id),
        getAssetMovements(id),
        getAssetAudit(id),
      ]);
      return { detail: d, lifecycle: lc, movements: mv, audit: au };
    },
    [id],
  );
}

export interface Asset360Data {
  detail: AssetDetail;
  lifecycle: LifecycleTransitions | null;
  movements: AssetMovement[];
  audit: AuditEvent[];
}
