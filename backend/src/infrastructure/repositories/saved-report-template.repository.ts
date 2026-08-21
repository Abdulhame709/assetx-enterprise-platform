import { Inject, Injectable } from '@nestjs/common';
import {
  CreateSavedReportTemplateInput,
  SavedReportTemplate,
  UpdateSavedReportTemplateInput,
} from '../../core/entities/saved-report-template.entity';
import { DatabasePort } from '../../core/ports/database.port';
import { SavedReportTemplatePort } from '../../core/ports/saved-report-template.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class SavedReportTemplateRepository implements SavedReportTemplatePort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: CreateSavedReportTemplateInput): Promise<SavedReportTemplate> {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `INSERT INTO report_templates
         (tenant_id, created_by, name, description, resource, format, definition, is_shared, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 1)
       RETURNING *`,
      [
        input.tenant_id,
        input.created_by,
        input.name,
        input.description ?? null,
        input.resource,
        input.format,
        JSON.stringify(input.definition),
        input.is_shared ?? false,
      ],
    );
    return this.normalize(rows[0]);
  }

  async findById(id: string, tenantId: string, userId: string): Promise<SavedReportTemplate | null> {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM report_templates
       WHERE id = $1 AND tenant_id = $2 AND (created_by = $3 OR is_shared = true)
       LIMIT 1`,
      [id, tenantId, userId],
    );
    return rows[0] ? this.normalize(rows[0]) : null;
  }

  async list(tenantId: string, userId: string, resource?: string): Promise<SavedReportTemplate[]> {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `SELECT * FROM report_templates
       WHERE tenant_id = $1
         AND (created_by = $2 OR is_shared = true)
         AND ($3::text IS NULL OR resource = $3)
       ORDER BY is_shared DESC, updated_at DESC, name ASC`,
      [tenantId, userId, resource ?? null],
    );
    return rows.map((row) => this.normalize(row));
  }

  async update(id: string, tenantId: string, userId: string, patch: UpdateSavedReportTemplateInput): Promise<SavedReportTemplate | null> {
    const { rows } = await this.db.query<Record<string, unknown>>(
      `UPDATE report_templates SET
         name = COALESCE($4, name),
         description = COALESCE($5, description),
         resource = COALESCE($6, resource),
         format = COALESCE($7, format),
         definition = COALESCE($8::jsonb, definition),
         is_shared = COALESCE($9, is_shared),
         version = version + 1,
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND created_by = $3
       RETURNING *`,
      [
        id,
        tenantId,
        userId,
        patch.name ?? null,
        patch.description === undefined ? null : patch.description,
        patch.resource ?? null,
        patch.format ?? null,
        patch.definition ? JSON.stringify(patch.definition) : null,
        patch.is_shared ?? null,
      ],
    );
    return rows[0] ? this.normalize(rows[0]) : null;
  }

  async remove(id: string, tenantId: string, userId: string): Promise<boolean> {
    const { rows } = await this.db.query<{ id: string }>(
      `DELETE FROM report_templates
       WHERE id = $1 AND tenant_id = $2 AND created_by = $3
       RETURNING id`,
      [id, tenantId, userId],
    );
    return rows.length > 0;
  }

  async countByUser(tenantId: string, userId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM report_templates WHERE tenant_id = $1 AND created_by = $2`,
      [tenantId, userId],
    );
    return Number(rows[0]?.c ?? 0);
  }

  async existsName(tenantId: string, userId: string, name: string, excludeId?: string): Promise<boolean> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM report_templates
       WHERE tenant_id = $1 AND created_by = $2 AND name = $3
         AND ($4::uuid IS NULL OR id <> $4::uuid)`,
      [tenantId, userId, name, excludeId ?? null],
    );
    return Number(rows[0]?.c ?? 0) > 0;
  }

  private normalize(row: Record<string, unknown>): SavedReportTemplate {
    const definition = typeof row.definition === 'string' ? JSON.parse(row.definition) : row.definition;
    return {
      ...row,
      created_by: String(row.created_by),
      definition: definition as SavedReportTemplate['definition'],
      is_shared: Boolean(row.is_shared),
      version: Number(row.version),
    } as SavedReportTemplate;
  }
}
