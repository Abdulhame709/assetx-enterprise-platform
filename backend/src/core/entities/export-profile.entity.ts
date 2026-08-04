/**
 * Export Profile entities — audience-driven export configuration (Task T8).
 * A profile describes WHICH columns an audience cares about, their display
 * labels, preferred format and default page size. Profiles are presentation/
 * configuration only: they contain no SQL, no business logic and no filtering
 * rules. Column application is an intersection with the actual row keys so the
 * same profile is safe across resources.
 * Reference: Task T8 — Enterprise Export Framework.
 */

export type ExportProfileId =
  | 'executive'
  | 'finance'
  | 'auditor'
  | 'inventory'
  | 'compliance';

/** A single column the audience wants in the export. */
export interface ExportProfileColumn {
  /** key present on the exported row object */
  key: string;
  /** optional display label (falls back to key) */
  label?: string;
  /** sort order (lower first) */
  order?: number;
}

export interface ExportProfile {
  id: ExportProfileId;
  name: string;
  description?: string;
  /** ordered columns for this audience */
  columns: ExportProfileColumn[];
  /** default format preferred by this audience */
  preferredFormat?: 'csv' | 'xlsx' | 'pdf';
  /** default page-size hint for streaming exports */
  pageSize?: number;
}
