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
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { DomainError } from '../common/http/domain-error';

@Injectable()
export class CategoryService {
  constructor(
    @Inject(CATEGORY_PORT) private readonly categories: CategoryPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateCategoryInput): Promise<Category> {
    await this.db.setTenant(input.tenant_id);
    const name = input.name?.trim();
    if (!name || name.length < 2) throw new Error('NAME_INVALID');
    if (await this.categories.existsName(input.tenant_id, name, input.parent_id ?? null)) {
      throw new Error('DUPLICATE_CATEGORY');
    }
    if (input.parent_id) {
      const parent = await this.categories.findById(input.parent_id, input.tenant_id);
      if (!parent) throw new Error('PARENT_NOT_FOUND');
    }
    return this.categories.create({ ...input, name });
  }

  async update(id: string, tenantId: string, input: UpdateCategoryInput): Promise<Category | null> {
    await this.db.setTenant(tenantId);
    const existing = await this.categories.findById(id, tenantId);
    if (!existing) throw new Error('CATEGORY_NOT_FOUND');

    const nextName = input.name === undefined ? existing.name : input.name.trim();
    if (nextName.length < 2) throw new Error('NAME_INVALID');
    const nextParentId = input.parent_id === undefined ? existing.parent_id : input.parent_id;

    await this.assertValidParent(id, tenantId, nextParentId);
    if (await this.categories.existsName(tenantId, nextName, nextParentId, id)) {
      throw new Error('DUPLICATE_CATEGORY');
    }

    return this.categories.update(id, tenantId, {
      ...input,
      ...(input.name !== undefined ? { name: nextName } : {}),
      ...(input.parent_id !== undefined ? { parent_id: nextParentId } : {}),
    });
  }

  /** Prevent self-parenting and moving a node below one of its descendants. */
  private async assertValidParent(id: string, tenantId: string, parentId: string | null): Promise<void> {
    if (!parentId) return;
    if (parentId === id) throw new Error('CATEGORY_CYCLE');

    const visited = new Set<string>();
    let currentId: string | null = parentId;
    while (currentId) {
      if (visited.has(currentId)) throw new Error('CATEGORY_CYCLE');
      visited.add(currentId);
      const current = await this.categories.findById(currentId, tenantId);
      if (!current) throw new Error('PARENT_NOT_FOUND');
      if (current.parent_id === id) throw new Error('CATEGORY_CYCLE');
      currentId = current.parent_id;
    }
  }

  async getById(id: string, tenantId: string): Promise<Category | null> {
    await this.db.setTenant(tenantId);
    return this.categories.findById(id, tenantId);
  }

  async list(tenantId: string): Promise<Category[]> {
    await this.db.setTenant(tenantId);
    return this.categories.list(tenantId);
  }

  async deactivate(id: string, tenantId: string, userId: string | null): Promise<void> {
    await this.db.setTenant(tenantId);
    const existing = await this.categories.findById(id, tenantId);
    if (!existing) throw new Error('CATEGORY_NOT_FOUND');
    const [childCategoryCount, assetCount] = await Promise.all([
      this.categories.countChildren(id, tenantId),
      this.categories.countAssets(id, tenantId),
    ]);
    if (childCategoryCount || assetCount) {
      throw new DomainError(childCategoryCount ? 'CATEGORY_HAS_CHILDREN' : 'CATEGORY_HAS_ASSETS', {
        child_category_count: childCategoryCount,
        asset_count: assetCount,
      });
    }
    await this.categories.deactivate(id, tenantId);
    await this.audit.log({
      tenant_id: tenantId, userId,
      action: AUDIT_EVENTS.CATEGORY_DEACTIVATED, entity: 'asset_category', entityId: id,
      metadata: { name: existing.name, soft_delete: true },
    }).catch(() => undefined);
  }
}
