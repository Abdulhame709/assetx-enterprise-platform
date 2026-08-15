'use client';

import { useAsync, AsyncState } from '@/lib/use-async';
import { getAssetTypes, createAssetType, updateAssetType, deactivateAssetType, AssetTypeNode } from './api';

export function useAssetTypes(): AsyncState<AssetTypeNode[]> {
  return useAsync<AssetTypeNode[]>(() => getAssetTypes(), [], { isEmpty: (d) => d.length === 0 });
}

export { createAssetType, updateAssetType, deactivateAssetType };
export type { AssetTypeNode };
