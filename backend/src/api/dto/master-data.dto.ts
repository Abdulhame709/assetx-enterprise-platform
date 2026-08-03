/**
 * Master-data request DTOs (Location/Category/Model/Employee).
 * Reference: API Spec (DOC-10) · FRS
 */

// Location
export interface CreateLocationDto {
  parent_id?: string;
  name: string;
  location_type?: 'building' | 'room' | 'warehouse' | 'workshop' | 'outdoor';
}
export interface UpdateLocationDto {
  name?: string;
  location_type?: 'building' | 'room' | 'warehouse' | 'workshop' | 'outdoor';
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
