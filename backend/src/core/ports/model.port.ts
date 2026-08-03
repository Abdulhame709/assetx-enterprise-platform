/**
 * ModelRepository port — abstract data access for asset models.
 */
import { Model } from '../entities/model.entity';

export interface CreateModelInput {
  tenant_id: string;
  category_id?: string | null;
  sub_type_id?: string | null;
  name: string;
}

export interface UpdateModelInput {
  name?: string;
  category_id?: string | null;
  sub_type_id?: string | null;
}

export interface ModelPort {
  create(input: CreateModelInput): Promise<Model>;
  update(id: string, tenantId: string, input: UpdateModelInput): Promise<Model | null>;
  findById(id: string, tenantId: string): Promise<Model | null>;
  list(tenantId: string): Promise<Model[]>;
  existsName(tenantId: string, name: string, excludeId?: string): Promise<boolean>;
}
