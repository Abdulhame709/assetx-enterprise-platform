/**
 * SavedSearchRepository — infrastructure implementation of SavedSearchPort.
 * Persists/retrieves saved searches only; no business logic. RLS respected.
 * Reference: ADR-011 · Data Dictionary (saved_searches)
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { SavedSearch, SavedSearchResource } from '../../core/entities/saved-search.entity';
import { SavedSearchPort } from '../../core/ports/saved-search.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class SavedSearchRepository implements SavedSearchPort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: {
    tenant_id: string;
    userId: string;
    name: string;
    resource: SavedSearchResource;
    filters: Record<string, unknown>;
    is_default?: boolean;
  }): Promise<SavedSearch> {
    const { rows } = await this.db.query<SavedSearch>(
      `INSERT INTO saved_searches (tenant_id, user_id, name, resource, filters, is_default, version)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, 1) RETURNING *`,
      [input.tenant_id, input.userId, input.name, input.resource,
        JSON.stringify(input.filters), input.is_default ?? false],
    );
    return rows[0];
  }

  async findById(id: string, tenantId: string, userId: string): Promise<SavedSearch | null> {
    const { rows } = await this.db.query<SavedSearch>(
      `SELECT * FROM saved_searches WHERE id = $1 AND tenant_id = $2 AND user_id = $3 LIMIT 1`,
      [id, tenantId, userId],
    );
    return rows[0] ?? null;
  }

  async list(tenantId: string, userId: string): Promise<SavedSearch[]> {
    const { rows } = await this.db.query<SavedSearch>(
      `SELECT * FROM saved_searches WHERE tenant_id = $1 AND user_id = $2 ORDER BY is_default DESC, created_at DESC`,
      [tenantId, userId],
    );
    return rows;
  }

  async update(id: string, tenantId: string, userId: string, patch: {
    name?: string;
    filters?: Record<string, unknown>;
    is_default?: boolean;
  }): Promise<SavedSearch | null> {
    const { rows } = await this.db.query<SavedSearch>(
      `UPDATE saved_searches SET
         name = COALESCE($4, name),
         filters = COALESCE($5::jsonb, filters),
         is_default = COALESCE($6, is_default),
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND user_id = $3
       RETURNING *`,
      [id, tenantId, userId, patch.name ?? null,
        patch.filters ? JSON.stringify(patch.filters) : null,
        patch.is_default ?? null],
    );
    return rows[0] ?? null;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `DELETE FROM saved_searches WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
      [id, tenantId, userId],
    );
    return (rowCount ?? 0) > 0;
  }

  async countByUser(tenantId: string, userId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM saved_searches WHERE tenant_id = $1 AND user_id = $2`,
      [tenantId, userId],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async existsName(tenantId: string, userId: string, name: string, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM saved_searches
       WHERE tenant_id = $1 AND user_id = $2 AND name = $3 AND ($4::uuid IS NULL OR id <> $4::uuid)`,
      [tenantId, userId, name, excludeId ?? null],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }
}
