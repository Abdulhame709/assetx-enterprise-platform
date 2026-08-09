/**
 * StatusService — application use cases for asset statuses (ENT-STATUS).
 * Follows the Category/Location master-data pattern.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import {
  StatusPort,
  CreateStatusInput,
  UpdateStatusInput,
} from '../core/ports/status.port';
import { Status } from '../core/entities/status.entity';
import { STATUS_PORT, DATABASE_PORT } from '../core/ports/tokens';

@Injectable()
export class StatusService {
  constructor(
    @Inject(STATUS_PORT) private readonly statuses: StatusPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async create(input: CreateStatusInput): Promise<Status> {
    await this.db.setTenant(input.tenant_id);
    if (!input.name || input.name.trim().length < 2) throw new Error('NAME_INVALID');
    if (input.color && !/^#[0-9a-fA-F]{6}$/.test(input.color)) throw new Error('COLOR_INVALID');
    if (await this.statuses.existsName(input.tenant_id, input.name)) throw new Error('DUPLICATE_STATUS');
    return this.statuses.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateStatusInput): Promise<Status | null> {
    await this.db.setTenant(tenantId);
    const existing = await this.statuses.findById(id, tenantId);
    if (!existing) throw new Error('STATUS_NOT_FOUND');
    if (input.color && !/^#[0-9a-fA-F]{6}$/.test(input.color)) throw new Error('COLOR_INVALID');
    if (input.name && input.name !== existing.name && await this.statuses.existsName(tenantId, input.name, id)) {
      throw new Error('DUPLICATE_STATUS');
    }
    return this.statuses.update(id, tenantId, input);
  }

  async getById(id: string, tenantId: string): Promise<Status | null> {
    await this.db.setTenant(tenantId);
    return this.statuses.findById(id, tenantId);
  }

  async list(tenantId: string): Promise<Status[]> {
    await this.db.setTenant(tenantId);
    return this.statuses.list(tenantId);
  }
}
