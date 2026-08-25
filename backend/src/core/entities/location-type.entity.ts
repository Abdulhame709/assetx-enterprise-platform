/** Tenant-scoped configurable location type. */
export interface LocationType {
  id: string;
  tenant_id: string;
  code: string;
  name_ar: string;
  name_en: string | null;
  icon_key: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_at: Date;
  updated_at: Date;
}
