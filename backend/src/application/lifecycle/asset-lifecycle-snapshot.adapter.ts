/**
 * AssetLifecycleSnapshotAdapter — builds an AssetLifecycleSnapshot from an
 * existing Asset + the latest approved movement (Task L1).
 * Reads ONLY (no writes). Uses the DatabasePort to fetch the latest approved
 * movement type for an asset. No schema change, no new repository.
 * Reference: Task L1 — Epic L.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { DATABASE_PORT } from '../../core/ports/tokens';
import { Asset } from '../../core/entities/asset.entity';
import { AssetLifecycleSnapshot } from '../../core/entities/lifecycle.entity';
import { MovementType } from '../../core/entities/movement.entity';

/** The minimal subset of Asset the derivation needs (no created_at/status_id). */
export type LifecycleAssetSource = Pick<Asset, 'id' | 'is_active' | 'employee_id'>;

@Injectable()
export class AssetLifecycleSnapshotAdapter {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  /**
   * Build a snapshot from an already-loaded Asset by fetching the latest
   * APPROVED movement type. created_at and status_id are not used in the
   * derivation (per design review).
   */
  async fromAsset(asset: LifecycleAssetSource, tenantId: string): Promise<AssetLifecycleSnapshot> {
    await this.db.setTenant(tenantId);
    const latest = await this.fetchLatestApprovedMovementType(asset.id, tenantId);
    return {
      isActive: asset.is_active,
      employeeId: asset.employee_id,
      latestMovementType: latest,
    };
  }

  /** Read-only query for the most recent approved movement type of an asset. */
  private async fetchLatestApprovedMovementType(assetId: string, tenantId: string): Promise<MovementType | null> {
    const res = await this.db.query<{ movement_type: MovementType }>(
      `SELECT movement_type FROM asset_movements
        WHERE asset_id = $1 AND tenant_id = $2 AND status = 'approved'
        ORDER BY created_at DESC LIMIT 1`,
      [assetId, tenantId],
    );
    return res.rows[0]?.movement_type ?? null;
  }
}
