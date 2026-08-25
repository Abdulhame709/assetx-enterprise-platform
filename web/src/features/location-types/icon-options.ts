import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  BriefcaseBusiness,
  DoorOpen,
  Factory,
  Layers3,
  MapPin,
  Store,
  TreePine,
  Warehouse,
} from 'lucide-react';

export const LOCATION_TYPE_ICON_OPTIONS: { key: string; icon: LucideIcon }[] = [
  { key: 'building', icon: Building2 },
  { key: 'room', icon: DoorOpen },
  { key: 'warehouse', icon: Warehouse },
  { key: 'workshop', icon: Factory },
  { key: 'outdoor', icon: TreePine },
  { key: 'map-pin', icon: MapPin },
  { key: 'layers', icon: Layers3 },
  { key: 'store', icon: Store },
  { key: 'briefcase', icon: BriefcaseBusiness },
];

export function getLocationTypeIcon(key?: string | null): LucideIcon {
  return LOCATION_TYPE_ICON_OPTIONS.find((item) => item.key === key)?.icon ?? MapPin;
}
