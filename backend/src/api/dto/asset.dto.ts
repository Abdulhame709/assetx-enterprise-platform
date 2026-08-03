/**
 * Asset request/response DTOs.
 * Reference: API Spec (DOC-10) §4 Asset endpoints
 */

export interface CreateAssetDto {
  name: string;
  description?: string;
  category_id: string;
  sub_type_id?: string;
  model_id?: string;
  location_id: string;
  quantity?: number;
  status_id: string;
  employee_id?: string;
  purchase_price?: number;
  purchase_date?: string;
  depreciation_rate?: number;
  useful_life?: number;
  serial_number?: string;
  barcode?: string;
  reference_number?: string;
  inventory_year?: number;
  notes?: string;
}

export interface UpdateAssetDto {
  name?: string;
  description?: string;
  category_id?: string;
  model_id?: string;
  location_id?: string;
  quantity?: number;
  employee_id?: string;
  purchase_price?: number;
  notes?: string;
}

export interface TransferAssetDto {
  to_location_id?: string;
  to_employee_id?: string;
  to_status_id?: string;
  reason?: string;
  reference_number?: string;
}

export interface ChangeStatusDto {
  status_id: string;
}

export interface AssetQueryDto {
  q?: string;
  status_id?: string;
  location_id?: string;
  category_id?: string;
  employee_id?: string;
  page?: number;
  limit?: number;
}
