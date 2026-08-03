/**
 * AssetService — application use cases for the Asset aggregate.
 * Create/Update/Get/Search/Transfer/ChangeStatus with validation & code generation.
 * Reference: Entity Spec (DOC-21) · Business Rules (BR-ASSET-*, BR-CODE-001) · FRS FR-ASSET-*
 */
import { Inject, Injectable } from '@nestjs/common';
import { AssetPort, CreateAssetInput, UpdateAssetInput, AssetFilter } from '../core/ports/asset.port';
import { Asset, AssetSummary } from '../core/entities/asset.entity';
import { DatabasePort } from '../core/ports/database.port';
import { ASSET_PORT, DATABASE_PORT } from '../core/ports/tokens';
import { AuditService } from './audit.service';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { EventBus } from '../core/events/event-bus';
import { DOMAIN_EVENTS } from '../core/events/event-types';
import { EVENT_BUS } from '../core/ports/tokens';

@Injectable()
export class AssetService {
  constructor(
    @Inject(ASSET_PORT) private readonly assets: AssetPort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly audit: AuditService,
    @Inject(EVENT_BUS) private readonly bus: EventBus,
  ) {}

  /** Validation (BR-ASSET-002): name, category, location, status required. */
  private validateCreate(input: CreateAssetInput): void {
    if (!input.name || input.name.trim().length < 2) throw new Error('ASSET_NAME_INVALID');
    if (!input.category_id) throw new Error('CATEGORY_REQUIRED');
    if (!input.location_id) throw new Error('LOCATION_REQUIRED');
    if (!input.status_id) throw new Error('STATUS_REQUIRED');
    if (input.quantity !== undefined && input.quantity <= 0) throw new Error('QUANTITY_INVALID');
    if (input.purchase_price !== undefined && input.purchase_price < 0) throw new Error('PRICE_INVALID');
    if (input.depreciation_rate !== undefined && (input.depreciation_rate < 0 || input.depreciation_rate > 100)) {
      throw new Error('DEPRECIATION_RATE_INVALID');
    }
  }

  async create(input: CreateAssetInput): Promise<AssetSummary> {
    this.validateCreate(input);
    // Scope the write to the target tenant so RLS (current_tenant_id) allows it.
    await this.db.setTenant(input.tenant_id);
    const created = await this.assets.create(input);
    await this.audit.log({
      tenant_id: input.tenant_id, userId: null,
      action: AUDIT_EVENTS.ASSET_CREATED, entity: 'asset', entityId: created.id,
      metadata: { name: created.name, code: created.full_asset_code },
    }).catch(() => undefined);
    // Notify: asset created
    this.bus.publish({
      event: DOMAIN_EVENTS.ASSET_CREATED,
      tenant_id: input.tenant_id,
      entityId: created.id,
      payload: { asset_name: created.name, asset_code: created.full_asset_code },
    });
    return created;
  }

  async getById(id: string, tenantId: string): Promise<Asset | null> {
    await this.db.setTenant(tenantId);
    return this.assets.findById(id, tenantId);
  }

  async update(id: string, tenantId: string, input: UpdateAssetInput): Promise<AssetSummary | null> {
    // Light validation on update
    if (input.quantity !== undefined && input.quantity <= 0) throw new Error('QUANTITY_INVALID');
    if (input.purchase_price !== undefined && input.purchase_price < 0) throw new Error('PRICE_INVALID');
    await this.db.setTenant(tenantId);
    const existing = await this.assets.findById(id, tenantId);
    if (!existing) throw new Error('ASSET_NOT_FOUND');
    const updated = await this.assets.update(id, input);
    await this.audit.log({
      tenant_id: tenantId, userId: null,
      action: AUDIT_EVENTS.ASSET_UPDATED, entity: 'asset', entityId: id,
      metadata: { fields: Object.keys(input) },
    }).catch(() => undefined);
    return updated;
  }

  async search(filter: AssetFilter): Promise<{ items: AssetSummary[]; total: number }> {
    await this.db.setTenant(filter.tenant_id);
    return this.assets.search(filter);
  }

  /** Transfer asset — records a movement and updates location/employee/status (BR-MOV-001). */
  async transfer(id: string, tenantId: string, dto: {
    to_location_id?: string;
    to_employee_id?: string;
    to_status_id?: string;
    reason?: string;
    reference_number?: string;
    performed_by?: string;
  }): Promise<{ asset: AssetSummary; movementId: string }> {
    await this.db.setTenant(tenantId);
    const existing = await this.assets.findById(id, tenantId);
    if (!existing) throw new Error('ASSET_NOT_FOUND');
    if (!dto.to_location_id && !dto.to_employee_id && !dto.to_status_id) {
      throw new Error('TRANSFER_TARGET_REQUIRED');
    }

    // Insert movement record (append-only, BR-MOV-004)
    const { rows } = await this.db.query<{ id: string }>(
      `INSERT INTO asset_movements
         (tenant_id, asset_id, movement_type, from_location_id, to_location_id,
          from_employee_id, to_employee_id, from_status_id, to_status_id,
          reason, reference_number, performed_by)
       VALUES ($1,$2,'transfer',$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        tenantId, id,
        existing.location_id, dto.to_location_id ?? null,
        existing.employee_id, dto.to_employee_id ?? null,
        existing.status_id, dto.to_status_id ?? null,
        dto.reason ?? null, dto.reference_number ?? null,
        dto.performed_by ?? null,
      ],
    );

    // Update the asset
    await this.db.query(
      `UPDATE assets SET
         location_id = COALESCE($2, location_id),
         employee_id = COALESCE($3, employee_id),
         status_id   = COALESCE($4, status_id),
         updated_at  = now()
       WHERE id = $1`,
      [id, dto.to_location_id ?? null, dto.to_employee_id ?? null, dto.to_status_id ?? null],
    );

    const updated = await this.assets.findById(id, tenantId);
    if (!updated) throw new Error('ASSET_NOT_FOUND');
    return { asset: this.toSummary(updated), movementId: rows[0].id };
  }

  /** Change asset status — BR-ASSET status transition. */
  async changeStatus(id: string, tenantId: string, statusId: string): Promise<AssetSummary | null> {
    await this.db.setTenant(tenantId);
    const existing = await this.assets.findById(id, tenantId);
    if (!existing) throw new Error('ASSET_NOT_FOUND');
    if (!statusId) throw new Error('STATUS_REQUIRED');
    const updated = await this.assets.updateStatus(id, tenantId, statusId);
    await this.audit.log({
      tenant_id: tenantId, userId: null,
      action: AUDIT_EVENTS.ASSET_STATUS_CHANGED, entity: 'asset', entityId: id,
      metadata: { to_status_id: statusId },
    }).catch(() => undefined);
    return updated;
  }

  private toSummary(a: Asset): AssetSummary {
    return {
      id: a.id,
      name: a.name,
      full_asset_code: a.full_asset_code,
      base_asset_code: a.base_asset_code,
      quantity: a.quantity,
      status_id: a.status_id,
      location_id: a.location_id,
      employee_id: a.employee_id,
      purchase_price: a.purchase_price,
      is_active: a.is_active,
    };
  }
}
