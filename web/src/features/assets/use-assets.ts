'use client';

import { useCallback, useEffect, useState } from 'react';
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

/** Load analytics summary. */
export function useAnalytics() {
  const [data, setData] = useState<AssetAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getAnalyticsSummary());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
}

/** Load paged asset list with filters. */
export function useAssetList(query: AssetQuery) {
  const [data, setData] = useState<{ items: AssetSummary[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await searchAssets(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
}

/** Load Asset 360 data (detail + lifecycle + movements + audit). */
export function useAsset360(id: string) {
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [lifecycle, setLifecycle] = useState<LifecycleTransitions | null>(null);
  const [movements, setMovements] = useState<AssetMovement[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [d, lc, mv, au] = await Promise.all([
          getAsset(id),
          getLifecycleTransitions(id),
          getAssetMovements(id),
          getAssetAudit(id),
        ]);
        if (!active) return;
        setDetail(d); setLifecycle(lc); setMovements(mv); setAudit(au);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load asset');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  return { detail, lifecycle, movements, audit, loading, error };
}
