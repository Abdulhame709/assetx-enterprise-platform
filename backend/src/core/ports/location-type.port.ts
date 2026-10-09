import { LocationType } from '../entities/location-type.entity';

export interface CreateLocationTypeInput {
  tenant_id: string;
  code: string;
  name_ar: string;
  name_en?: string | null;
  icon_key?: string;
  sort_order?: number;
}

export interface UpdateLocationTypeInput {
  name_ar?: string;
  name_en?: string | null;
  icon_key?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface LocationTypePort {
  create(input: CreateLocationTypeInput): Promise<LocationType>;
  update(id: string, tenantId: string, input: UpdateLocationTypeInput): Promise<LocationType | null>;
  findById(id: string, tenantId: string): Promise<LocationType | null>;
  findByCode(code: string, tenantId: string, includeInactive?: boolean): Promise<LocationType | null>;
  list(tenantId: string, includeInactive?: boolean): Promise<LocationType[]>;
  existsCode(tenantId: string, code: string, excludeId?: string): Promise<boolean>;
  existsName(tenantId: string, nameAr: string, excludeId?: string): Promise<boolean>;
  countLocations(code: string, tenantId: string): Promise<number>;
  deactivate(id: string, tenantId: string): Promise<void>;
}
