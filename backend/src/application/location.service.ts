/**
 * LocationService — application use cases for hierarchical locations (ENT-LOCATION).
 * Reference: FRS FR-LOC-* · Entity Spec §5.10 · ADR-005
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import {
  LocationPort,
  CreateLocationInput,
  UpdateLocationInput,
} from '../core/ports/location.port';
import { Location } from '../core/entities/location.entity';
import { DATABASE_PORT, LOCATION_PORT } from '../core/ports/tokens';

@Injectable()
export class LocationService {
  constructor(
    @Inject(LOCATION_PORT) private readonly locations: LocationPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async create(input: CreateLocationInput): Promise<Location> {
    await this.db.setTenant(input.tenant_id);
    if (!input.name || input.name.trim().length < 2) throw new Error('NAME_INVALID');
    if (await this.locations.existsName(input.tenant_id, input.name, input.parent_id ?? null)) {
      throw new Error('DUPLICATE_LOCATION');
    }
    if (input.parent_id) {
      const parent = await this.locations.findById(input.parent_id, input.tenant_id);
      if (!parent) throw new Error('PARENT_NOT_FOUND');
    }
    return this.locations.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateLocationInput): Promise<Location | null> {
    await this.db.setTenant(tenantId);
    const existing = await this.locations.findById(id, tenantId);
    if (!existing) throw new Error('LOCATION_NOT_FOUND');
    if (input.name && input.name !== existing.name && await this.locations.existsName(tenantId, input.name, existing.parent_id, id)) {
      throw new Error('DUPLICATE_LOCATION');
    }
    return this.locations.update(id, tenantId, input);
  }

  async getById(id: string, tenantId: string): Promise<Location | null> {
    await this.db.setTenant(tenantId);
    return this.locations.findById(id, tenantId);
  }

  async list(tenantId: string): Promise<Location[]> {
    await this.db.setTenant(tenantId);
    return this.locations.list(tenantId);
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.db.setTenant(tenantId);
    const existing = await this.locations.findById(id, tenantId);
    if (!existing) throw new Error('LOCATION_NOT_FOUND');
    const children = await this.locations.countChildren(id, tenantId);
    if (children > 0) throw new Error('LOCATION_HAS_CHILDREN');
    const assets = await this.locations.countAssets(id, tenantId);
    if (assets > 0) throw new Error('LOCATION_HAS_ASSETS');
    await this.locations.softDelete(id, tenantId);
  }
}
