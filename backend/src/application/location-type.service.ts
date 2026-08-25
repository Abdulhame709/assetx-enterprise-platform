import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { DomainError } from '../common/http/domain-error';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { AuditService } from './audit.service';
import {
  CreateLocationTypeInput,
  LocationTypePort,
  UpdateLocationTypeInput,
} from '../core/ports/location-type.port';
import { LocationType } from '../core/entities/location-type.entity';
import { DATABASE_PORT, LOCATION_TYPE_PORT } from '../core/ports/tokens';

const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const ICON_PATTERN = /^[a-z0-9-]+$/;

@Injectable()
export class LocationTypeService {
  constructor(
    @Inject(LOCATION_TYPE_PORT) private readonly types: LocationTypePort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateLocationTypeInput): Promise<LocationType> {
    await this.db.setTenant(input.tenant_id);
    const code = input.code.trim().toLowerCase();
    const nameAr = input.name_ar.trim();
    const nameEn = input.name_en?.trim() || null;
    const iconKey = input.icon_key?.trim().toLowerCase() || 'map-pin';
    this.validate(code, nameAr, nameEn, iconKey, input.sort_order);
    if (await this.types.existsCode(input.tenant_id, code)) throw new Error('DUPLICATE_LOCATION_TYPE_CODE');
    if (await this.types.existsName(input.tenant_id, nameAr)) throw new Error('DUPLICATE_LOCATION_TYPE_NAME');
    return this.types.create({
      ...input,
      code,
      name_ar: nameAr,
      name_en: nameEn,
      icon_key: iconKey,
    });
  }

  async update(id: string, tenantId: string, input: UpdateLocationTypeInput): Promise<LocationType | null> {
    await this.db.setTenant(tenantId);
    const existing = await this.types.findById(id, tenantId);
    if (!existing) throw new Error('LOCATION_TYPE_NOT_FOUND');
    const nameAr = input.name_ar === undefined ? existing.name_ar : input.name_ar.trim();
    const nameEn = input.name_en === undefined ? existing.name_en : input.name_en?.trim() || null;
    const iconKey = input.icon_key === undefined ? existing.icon_key : input.icon_key.trim().toLowerCase();
    this.validate(existing.code, nameAr, nameEn, iconKey, input.sort_order);
    if (await this.types.existsName(tenantId, nameAr, id)) throw new Error('DUPLICATE_LOCATION_TYPE_NAME');
    if (input.is_active === false && existing.is_active) {
      const locationCount = await this.types.countLocations(existing.code, tenantId);
      if (locationCount > 0) throw new DomainError('LOCATION_TYPE_HAS_LOCATIONS', { location_count: locationCount });
    }
    return this.types.update(id, tenantId, {
      ...input,
      name_ar: nameAr,
      name_en: nameEn,
      icon_key: iconKey,
    });
  }

  async list(tenantId: string, includeInactive = false): Promise<LocationType[]> {
    await this.db.setTenant(tenantId);
    return this.types.list(tenantId, includeInactive);
  }

  async getById(id: string, tenantId: string): Promise<LocationType | null> {
    await this.db.setTenant(tenantId);
    return this.types.findById(id, tenantId);
  }

  async deactivate(id: string, tenantId: string, userId: string | null): Promise<void> {
    await this.db.setTenant(tenantId);
    const existing = await this.types.findById(id, tenantId);
    if (!existing) throw new Error('LOCATION_TYPE_NOT_FOUND');
    const locationCount = await this.types.countLocations(existing.code, tenantId);
    if (locationCount > 0) throw new DomainError('LOCATION_TYPE_HAS_LOCATIONS', { location_count: locationCount });
    await this.types.deactivate(id, tenantId);
    await this.audit.log({
      tenant_id: tenantId,
      userId,
      action: AUDIT_EVENTS.LOCATION_TYPE_DEACTIVATED,
      entity: 'location_type',
      entityId: id,
      metadata: { code: existing.code, name_ar: existing.name_ar, soft_delete: true },
    }).catch(() => undefined);
  }

  private validate(code: string, nameAr: string, nameEn: string | null, iconKey: string, sortOrder?: number): void {
    if (code.length < 2 || code.length > 64 || !CODE_PATTERN.test(code)) throw new Error('LOCATION_TYPE_CODE_INVALID');
    if (nameAr.length < 2 || nameAr.length > 120) throw new Error('NAME_INVALID');
    if (nameEn && (nameEn.length < 2 || nameEn.length > 120)) throw new Error('LOCATION_TYPE_NAME_EN_INVALID');
    if (iconKey.length < 2 || iconKey.length > 48 || !ICON_PATTERN.test(iconKey)) throw new Error('LOCATION_TYPE_ICON_INVALID');
    if (sortOrder !== undefined && (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999)) throw new Error('LOCATION_TYPE_SORT_INVALID');
  }
}
