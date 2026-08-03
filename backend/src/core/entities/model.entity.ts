/**
 * Model entity — ENT-MODEL (BC-ASSET) — manufacturer/model reference.
 * Reference: Entity Spec (DOC-21) §5.8 · Data Dictionary (DOC-24) TB-ASSET-MODEL
 */
export interface Model {
  id: string;
  tenant_id: string;
  category_id: string | null;
  sub_type_id: string | null;
  name: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
