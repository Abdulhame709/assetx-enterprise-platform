/**
 * Category entity — ENT-CATEGORY (BC-ASSET) — hierarchical asset classification.
 * Reference: Entity Spec (DOC-21) §5.7 · Data Dictionary (DOC-24) TB-CATEGORY
 */
export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  parent_id: string | null;
  full_path: string | null;
  level_number: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
