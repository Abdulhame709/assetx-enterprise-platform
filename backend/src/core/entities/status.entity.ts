/**
 * Status entity — asset status master data (ENT-STATUS).
 * Reference: Data Dictionary (DOC-24) TB-STATUS · AAB §13.9 (StatusColor)
 * Field names match the existing `statuses` table exactly; no new columns, no migration.
 */
export interface Status {
  id: string;
  tenant_id: string;
  name: string;
  color: string | null; // hex color (StatusColor)
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
