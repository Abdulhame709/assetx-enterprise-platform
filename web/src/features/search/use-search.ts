import { useMemo } from 'react';
import { getReferenceNames } from '@/features/assets/api';
import { EMPTY_NAMES, NameLookup } from '@/features/assets/mappers';
import { AsyncState, useAsync } from '@/lib/use-async';
import { AdvancedSearchQuery, SearchItem, SearchPage, SearchResource, searchResource } from './api';

function useSearchNames(): NameLookup {
  return useAsync<NameLookup>(() => getReferenceNames(), []).data ?? EMPTY_NAMES;
}

export function useAdvancedSearch(resource: SearchResource, query: AdvancedSearchQuery, enabled = true): AsyncState<SearchPage<SearchItem>> {
  const names = useSearchNames();
  const key = JSON.stringify({ resource, query, enabled });
  return useAsync(
    () => enabled
      ? searchResource(resource, JSON.parse(key).query as AdvancedSearchQuery, names)
      : Promise.resolve({ items: [], total: 0, page: 1, limit: query.limit, hasMore: false }),
    [key, names],
    { isEmpty: (data) => data.items.length === 0 },
  );
}

export function useStableSearchQuery(input: AdvancedSearchQuery): AdvancedSearchQuery {
  const filtersKey = JSON.stringify(input.filters);
  return useMemo(() => input, [
    input.q,
    input.sort,
    input.dir,
    input.page,
    input.limit,
    filtersKey,
  ]);
}
