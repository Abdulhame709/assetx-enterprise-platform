'use client';

import { useAsync, AsyncState } from '@/lib/use-async';
import { listLocationTypes, LocationTypeOption } from './api';

export function useLocationTypes(): AsyncState<LocationTypeOption[]> {
  return useAsync<LocationTypeOption[]>(() => listLocationTypes(), [], { isEmpty: (items) => items.length === 0 });
}

export { listLocationTypes } from './api';
export type { LocationTypeOption } from './api';
