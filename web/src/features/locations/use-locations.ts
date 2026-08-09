'use client';

import { useAsync, AsyncState } from '@/lib/use-async';
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  LocationNode,
  LocationType,
} from './api';

export function useLocations(): AsyncState<LocationNode[]> {
  return useAsync<LocationNode[]>(() => getLocations(), [], { isEmpty: (d) => d.length === 0 });
}

export { createLocation, updateLocation, deleteLocation };
export type { LocationNode, LocationType };
