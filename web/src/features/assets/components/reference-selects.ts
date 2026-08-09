/**
 * Form-friendly reference selectors (location list with full-path labels).
 * Kept separate from components to avoid circular imports with feature APIs.
 */
import { getLocations } from '@/features/locations/api';
import { getCategories, CategoryOption } from '../api';

export type { CategoryOption };

/** Locations as select options labeled by full path (HQ / Floor 1 / Room 101). */
export async function getLocationsTree(): Promise<CategoryOption[]> {
  const nodes = await getLocations();
  return nodes
    .filter((l) => l.is_active)
    .map((l) => ({ value: l.id, label: l.full_path || l.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export { getCategories };
