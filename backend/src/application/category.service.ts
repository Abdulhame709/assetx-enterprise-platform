/**
 * CategoryService — application use cases for asset categories (ENT-CATEGORY).
 * Reference: FRS FR-CAT-* · Entity Spec §5.7
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import {
  CategoryPort,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../core/ports/category.port';
import { Category } from '../core/entities/category.entity';
import { CATEGORY_PORT, DATABASE_PORT } from '../core/ports/tokens';

@Injectable()
export class CategoryService {
  constructor(
    @Inject(CATEGORY_PORT) private readonly categories: CategoryPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async create(input: CreateCategoryInput): Promise<Category> {
    await this.db.setTenant(input.tenant_id);
    if (!input.name || input.name.trim().length < 2) throw new Error('NAME_INVALID');
    if (await this.categories.existsName(input.tenant_id, input.name)) throw new Error('DUPLICATE_CATEGORY');
    if (input.parent_id) {
      const parent = await this.categories.findById(input.parent_id, input.tenant_id);
      if (!parent) throw new Error('PARENT_NOT_FOUND');
    }
    return this.categories.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateCategoryInput): Promise<Category | null> {
    await this.db.setTenant(tenantId);
    const existing = await this.categories.findById(id, tenantId);
    if (!existing) throw new Error('CATEGORY_NOT_FOUND');
    if (input.name && input.name !== existing.name && await this.categories.existsName(tenantId, input.name, id)) {
      throw new Error('DUPLICATE_CATEGORY');
    }
    return this.categories.update(id, tenantId, input);
  }

  async getById(id: string, tenantId: string): Promise<Category | null> {
    await this.db.setTenant(tenantId);
    return this.categories.findById(id, tenantId);
  }

  async list(tenantId: string): Promise<Category[]> {
    await this.db.setTenant(tenantId);
    return this.categories.list(tenantId);
  }
}
