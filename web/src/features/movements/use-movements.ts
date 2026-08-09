'use client';

import { useAsync, AsyncState } from '@/lib/use-async';
import {
  listMovements,
  getMovementLookups,
  enrichMovements,
  MovementFilter,
  MovementRow,
  MovementLookups,
  PagedMovements,
} from './api';

export interface MovementsData {
  /** Paged + enriched rows for the current filter. */
  page: PagedMovements;
  /** Reference lookups (also used to build filter option lists). */
  lookups: MovementLookups;
  /** Total pending approvals (real count via status=pending&limit=1) — the inbox badge. */
  pendingTotal: number;
}

/**
 * Load one page of movements for the given filter and enrich with names.
 * Status 'empty' is handled by the table (empty prop), so the hook stays
 * 'success' whenever the request succeeds — filters must remain visible.
 */
export function useMovements(filter: MovementFilter): AsyncState<MovementsData> {
  const key = JSON.stringify(filter);
  return useAsync<MovementsData>(
    async () => {
      const parsed = JSON.parse(key) as MovementFilter;
      const [page, lookups, pending] = await Promise.all([
        listMovements(parsed),
        getMovementLookups(),
        listMovements({ ...parsed, status: 'pending', page: 1, limit: 1 }),
      ]);
      return {
        page: { ...page, items: enrichMovements(page.items, lookups) },
        lookups,
        pendingTotal: pending.total,
      };
    },
    [key],
  );
}

/** Detail-modal row already carries all fields; re-export for page typing. */
export type { MovementRow };
