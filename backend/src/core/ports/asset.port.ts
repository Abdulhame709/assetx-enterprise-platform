/**
 * AssetRepository port — abstract data access for assets (Clean Architecture).
 * The application layer depends on this abstraction; infrastructure implements it.
 */
import { Asset, AssetSummary } from '../entities/asset.entity';

export interface CreateAssetInput {
  tenant_id: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  sub_type_id?: string | null;
  model_id?: string | null;
  location_id?: string | null;
  quantity?: number;
  status_id?: string | null;
  employee_id?: string | null;
  purchase_price?: number;
  purchase_date?: string | null;
  depreciation_rate?: number;
  useful_life?: number;
  serial_number?: string | null;
  barcode?: string | null;
  reference_number?: string | null;
  inventory_year?: number | null;
  notes?: string | null;
}

export interface UpdateAssetInput {
  name?: string;
  description?: string | null;
  category_id?: string | null;
  model_id?: string | null;
  location_id?: string | null;
  quantity?: number;
  employee_id?: string | null;
  purchase_price?: number;
  notes?: string | null;
}

export interface AssetFilter {
  tenant_id: string;
  q?: string;          // smart search
  status_id?: string;
  location_id?: string; // includes descendants via path prefix
  category_id?: string;
  employee_id?: string;
  /** advanced search fields */
  barcode?: string;
  serial_number?: string;
  reference_number?: string;
  purchase_date_from?: string;
  purchase_date_to?: string;
  price_from?: number;
  price_to?: number;
  is_active?: boolean;
  sortField?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AssetPort {
  create(input: CreateAssetInput): Promise<AssetSummary>;
  update(id: string, input: UpdateAssetInput): Promise<AssetSummary | null>;
  findById(id: string, tenantId: string): Promise<Asset | null>;
  search(filter: AssetFilter): Promise<{ items: AssetSummary[]; total: number }>;
  /** advanced search with dynamic filters + sorting */
  searchAdvanced(filter: AssetFilter): Promise<{ items: AssetSummary[]; total: number }>;
  updateStatus(id: string, tenantId: string, statusId: string): Promise<AssetSummary | null>;
  /** Generate the next base asset code for a year (BR-CODE-001). */
  nextBaseCode(year: number): Promise<string>;
}
