/**
 * CategoryRepository port — abstract data access for asset categories.
 */
import { Category } from '../entities/category.entity';

export interface CreateCategoryInput {
  tenant_id: string;
  name: string;
  parent_id?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  parent_id?: string | null;
}

export interface CategoryPort {
  create(input: CreateCategoryInput): Promise<Category>;
  update(id: string, tenantId: string, input: UpdateCategoryInput): Promise<Category | null>;
  findById(id: string, tenantId: string): Promise<Category | null>;
  list(tenantId: string): Promise<Category[]>;
  existsName(tenantId: string, name: string, excludeId?: string): Promise<boolean>;
  /** Count assets using a category (protect against orphan delete if needed). */
  countAssets(id: string, tenantId: string): Promise<number>;
}
