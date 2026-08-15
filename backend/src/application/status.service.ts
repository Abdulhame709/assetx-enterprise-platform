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
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { DomainError } from '../common/http/domain-error';

@Injectable()
export class StatusService {
  constructor(
    @Inject(STATUS_PORT) private readonly statuses: StatusPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly audit: AuditService,
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

  async deactivate(id: string, tenantId: string, userId: string | null): Promise<void> {
    await this.db.setTenant(tenantId);
    const existing = await this.statuses.findById(id, tenantId);
    if (!existing) throw new Error('STATUS_NOT_FOUND');
    const assetCount = await this.statuses.countAssets(id, tenantId);
    if (assetCount) throw new DomainError('STATUS_HAS_ASSETS', { asset_count: assetCount });
    await this.statuses.deactivate(id, tenantId);
    await this.audit.log({
      tenant_id: tenantId, userId,
      action: AUDIT_EVENTS.STATUS_DEACTIVATED, entity: 'status', entityId: id,
      metadata: { name: existing.name, soft_delete: true },
    }).catch(() => undefined);
  }
}
