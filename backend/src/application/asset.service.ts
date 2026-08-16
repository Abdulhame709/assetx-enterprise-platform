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
import { calculateDepreciation, DepreciationResult } from './asset-algorithms';

export interface AssetDepreciation extends DepreciationResult {
  asset_id: string;
  purchase_price: number;
  purchase_date: string;
  depreciation_rate: number;
  useful_life: number | null;
}

export interface AssetReferenceSummary {
  movements: number;
  inventory_records: number;
  maintenance_orders: number;
  open_inventory_cycles: number;
}

export interface BulkAssetUpdateInput {
  asset_ids: string[];
  location_id?: string;
  employee_id?: string | null;
  status_id?: string;
  notes?: string | null;
}

export interface BulkAssetUpdateResult {
  updated: string[];
  failed: { id: string; reason: string }[];
}

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

  /**
   * Calculates the live straight-line depreciation view defined in README §13.
   * It intentionally does not persist a derived value: the result must reflect
   * the current date and the source purchase/depreciation fields at read time.
   */
  async getDepreciation(id: string, tenantId: string): Promise<AssetDepreciation | null> {
    const asset = await this.getById(id, tenantId);
    if (!asset) throw new Error('ASSET_NOT_FOUND');
    if (!asset.purchase_date || asset.depreciation_rate === null) return null;

    const purchasePrice = Number(asset.purchase_price);
    const depreciationRate = Number(asset.depreciation_rate);
    return {
      asset_id: asset.id,
      purchase_price: purchasePrice,
      purchase_date: asset.purchase_date,
      depreciation_rate: depreciationRate,
      useful_life: asset.useful_life,
      ...calculateDepreciation({
        purchasePrice,
        depreciationRate,
        purchaseDate: asset.purchase_date,
      }),
    };
  }

  async update(id: string, tenantId: string, input: UpdateAssetInput): Promise<AssetSummary | null> {
    // Light validation on update
    if (input.quantity !== undefined && input.quantity <= 0) throw new Error('QUANTITY_INVALID');
    if (input.purchase_price !== undefined && input.purchase_price < 0) throw new Error('PRICE_INVALID');
    await this.db.setTenant(tenantId);
    const existing = await this.assets.findById(id, tenantId);
    if (!existing) throw new Error('ASSET_NOT_FOUND');
    if (input.name !== undefined && input.name.trim().length < 2) throw new Error('ASSET_NAME_INVALID');
    if (this.hasProtectedChanges(input) && await this.hasReferences(id, tenantId)) {
      throw new Error('ASSET_HAS_REFERENCES');
    }
    const updated = await this.assets.update(id, input);
    await this.audit.log({
      tenant_id: tenantId, userId: null,
      action: AUDIT_EVENTS.ASSET_UPDATED, entity: 'asset', entityId: id,
      metadata: { fields: Object.keys(input) },
    }).catch(() => undefined);
    return updated;
  }

  /** Soft delete preserves the audit trail and historical operational records. */
  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.db.setTenant(tenantId);
    const existing = await this.assets.findById(id, tenantId);
    if (!existing) throw new Error('ASSET_NOT_FOUND');
    if (await this.hasReferences(id, tenantId)) throw new Error('ASSET_HAS_REFERENCES');
    await this.db.query(
      `UPDATE assets SET is_active = false, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
    await this.audit.log({
      tenant_id: tenantId, userId: null,
      action: AUDIT_EVENTS.ASSET_DELETED, entity: 'asset', entityId: id,
      metadata: { name: existing.name, soft_delete: true },
    }).catch(() => undefined);
  }

  /** A restricted, result-oriented bulk update used by the selected-row toolbar. */
  async bulkUpdate(tenantId: string, input: BulkAssetUpdateInput): Promise<BulkAssetUpdateResult> {
    const ids = [...new Set(input.asset_ids ?? [])];
    if (ids.length === 0) throw new Error('ASSET_BULK_EMPTY');
    const has = (key: keyof BulkAssetUpdateInput) => Object.prototype.hasOwnProperty.call(input, key);
    const changes: { column: string; value: unknown }[] = [];
    if (has('location_id')) changes.push({ column: 'location_id', value: input.location_id ?? null });
    if (has('employee_id')) changes.push({ column: 'employee_id', value: input.employee_id ?? null });
    if (has('status_id')) changes.push({ column: 'status_id', value: input.status_id ?? null });
    if (has('notes')) changes.push({ column: 'notes', value: input.notes ?? null });
    if (changes.length === 0) throw new Error('ASSET_BULK_FIELDS_REQUIRED');

    await this.db.setTenant(tenantId);
    const setClause = changes.map((change, index) => `${change.column} = $${index + 3}`).join(', ');
    const values = changes.map((change) => change.value);
    const result: BulkAssetUpdateResult = { updated: [], failed: [] };

    for (const id of ids) {
      const asset = await this.assets.findById(id, tenantId);
      if (!asset) {
        result.failed.push({ id, reason: 'ASSET_NOT_FOUND' });
        continue;
      }
      if (await this.hasReferences(id, tenantId)) {
        result.failed.push({ id, reason: 'ASSET_HAS_REFERENCES' });
        continue;
      }
      const updated = await this.db.query<{ id: string }>(
        `UPDATE assets SET ${setClause}, updated_at = now()
         WHERE id = $1 AND tenant_id = $2 AND is_active = true
         RETURNING id`,
        [id, tenantId, ...values],
      );
      if (updated.rows[0]) result.updated.push(id);
      else result.failed.push({ id, reason: 'ASSET_NOT_FOUND' });
    }

    await this.audit.log({
      tenant_id: tenantId, userId: null,
      action: AUDIT_EVENTS.ASSET_UPDATED, entity: 'asset', entityId: result.updated[0] ?? null,
      metadata: { bulk: true, fields: changes.map((change) => change.column), updated: result.updated, failed: result.failed },
    }).catch(() => undefined);
    return result;
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

  private hasProtectedChanges(input: UpdateAssetInput): boolean {
    return input.category_id !== undefined || input.location_id !== undefined ||
      input.quantity !== undefined || input.employee_id !== undefined;
  }

  private async hasReferences(assetId: string, tenantId: string): Promise<boolean> {
    const summary = await this.referenceSummary(assetId, tenantId);
    return Object.values(summary).some((count) => count > 0);
  }

  private async referenceSummary(assetId: string, tenantId: string): Promise<AssetReferenceSummary> {
    const [movements, records, maintenance, openCycles] = await Promise.all([
      this.db.query<{ c: string }>('SELECT count(*) AS c FROM asset_movements WHERE tenant_id = $1 AND asset_id = $2', [tenantId, assetId]),
      this.db.query<{ c: string }>('SELECT count(*) AS c FROM inventory_records WHERE tenant_id = $1 AND asset_id = $2', [tenantId, assetId]),
      this.db.query<{ c: string }>('SELECT count(*) AS c FROM maintenance_orders WHERE tenant_id = $1 AND asset_id = $2', [tenantId, assetId]),
      this.db.query<{ c: string }>(
        `SELECT count(*) AS c FROM inventory_records ir
         JOIN inventory_cycles ic ON ic.id = ir.cycle_id AND ic.tenant_id = ir.tenant_id
         WHERE ir.tenant_id = $1 AND ir.asset_id = $2 AND ic.status <> 'closed'`,
        [tenantId, assetId],
      ),
    ]);
    return {
      movements: Number(movements.rows[0]?.c ?? 0),
      inventory_records: Number(records.rows[0]?.c ?? 0),
      maintenance_orders: Number(maintenance.rows[0]?.c ?? 0),
      open_inventory_cycles: Number(openCycles.rows[0]?.c ?? 0),
    };
  }
}
