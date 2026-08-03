/**
 * ModelService — application use cases for asset models (ENT-MODEL).
 * Reference: FRS FR-CAT-003 · Entity Spec §5.8
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { ModelPort, CreateModelInput, UpdateModelInput } from '../core/ports/model.port';
import { Model } from '../core/entities/model.entity';
import { DATABASE_PORT, MODEL_PORT } from '../core/ports/tokens';

@Injectable()
export class ModelService {
  constructor(
    @Inject(MODEL_PORT) private readonly models: ModelPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async create(input: CreateModelInput): Promise<Model> {
    await this.db.setTenant(input.tenant_id);
    if (!input.name || input.name.trim().length < 2) throw new Error('NAME_INVALID');
    if (await this.models.existsName(input.tenant_id, input.name)) throw new Error('DUPLICATE_MODEL');
    return this.models.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateModelInput): Promise<Model | null> {
    await this.db.setTenant(tenantId);
    const existing = await this.models.findById(id, tenantId);
    if (!existing) throw new Error('MODEL_NOT_FOUND');
    if (input.name && input.name !== existing.name && await this.models.existsName(tenantId, input.name, id)) {
      throw new Error('DUPLICATE_MODEL');
    }
    return this.models.update(id, tenantId, input);
  }

  async getById(id: string, tenantId: string): Promise<Model | null> {
    await this.db.setTenant(tenantId);
    return this.models.findById(id, tenantId);
  }

  async list(tenantId: string): Promise<Model[]> {
    await this.db.setTenant(tenantId);
    return this.models.list(tenantId);
  }
}
