/**
 * Master-data request DTOs (Location/Category/Model/Employee).
 * Reference: API Spec (DOC-10) · FRS
 */

// Location
export interface CreateLocationDto {
  parent_id?: string;
  name: string;
  location_type?: string;
}
export interface UpdateLocationDto {
  name?: string;
  location_type?: string;
}

// Configurable location-type catalog
export interface CreateLocationTypeDto {
  code: string;
  name_ar: string;
  name_en?: string;
  icon_key?: string;
  sort_order?: number;
}
export interface UpdateLocationTypeDto {
  name_ar?: string;
  name_en?: string | null;
  icon_key?: string;
  sort_order?: number;
  is_active?: boolean;
}

// Category
export interface CreateCategoryDto {
  parent_id?: string;
  name: string;
}
export interface UpdateCategoryDto {
  name?: string;
  parent_id?: string;
}

// Status (asset status master data — existing `statuses` table; no migration)
export interface CreateStatusDto {
  name: string;
  color?: string;
}
export interface UpdateStatusDto {
  name?: string;
  color?: string;
}

// Model
export interface CreateModelDto {
  category_id?: string;
  sub_type_id?: string;
  name: string;
}
export interface UpdateModelDto {
  name?: string;
  category_id?: string;
  sub_type_id?: string;
}

// Employee
export interface CreateEmployeeDto {
  name: string;
  department?: string;
  phone?: string;
  email?: string;
}
export interface UpdateEmployeeDto {
  name?: string;
  department?: string;
  phone?: string;
  email?: string;
}
