/**
 * Location entity — ENT-LOCATION (BC-LOCATION) — Aggregate Root.
 * Reference: Entity Spec (DOC-21) §5.10 · Data Dictionary (DOC-24) TB-LOCATION
 * Field names match the database schema exactly; no new columns.
 */
export interface Location {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  name: string;
  location_type: 'building' | 'room' | 'warehouse' | 'workshop' | 'outdoor';
  path: string;        // materialized path (LTREE-compatible, ADR-005)
  full_path: string;   // display name
  level_number: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
