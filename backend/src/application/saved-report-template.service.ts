import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from './audit.service';
import { ReportBuilderService } from './report-builder.service';
import {
  CreateSavedReportTemplateInput,
  SavedReportTemplate,
  UpdateSavedReportTemplateInput,
} from '../core/entities/saved-report-template.entity';
import { ExportFormat, ExportResource } from '../core/entities/export.entity';
import { ReportDefinition } from '../core/entities/report.entity';
import { AUDIT_EVENTS } from '../core/constants/audit-events';
import { DATABASE_PORT, SAVED_REPORT_TEMPLATE_PORT } from '../core/ports/tokens';
import { DatabasePort } from '../core/ports/database.port';
import { SavedReportTemplatePort } from '../core/ports/saved-report-template.port';

const MAX_PER_USER = 100;
const MAX_PAYLOAD_BYTES = 64 * 1024;
const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const RESOURCES: ExportResource[] = ['assets', 'movements', 'inventory', 'audit', 'dashboard'];
const FORMATS: ExportFormat[] = ['csv', 'xlsx', 'pdf'];

@Injectable()
export class SavedReportTemplateService {
  constructor(
    @Inject(SAVED_REPORT_TEMPLATE_PORT) private readonly templates: SavedReportTemplatePort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
    private readonly reportBuilder: ReportBuilderService,
    private readonly audit: AuditService,
  ) {}

  async create(tenantId: string, userId: string, input: Omit<CreateSavedReportTemplateInput, 'tenant_id' | 'created_by'>): Promise<SavedReportTemplate> {
    await this.db.setTenant(tenantId);
    const name = this.validateName(input.name);
    const description = this.validateDescription(input.description);
    const definition = this.normalizeDefinition(name, input.resource, input.format, input.definition);
    if (this.payloadSize(definition) > MAX_PAYLOAD_BYTES) throw new Error('REPORT_TEMPLATE_PAYLOAD_TOO_LARGE');
    if (await this.templates.existsName(tenantId, userId, name)) throw new Error('REPORT_TEMPLATE_NAME_EXISTS');
    if (await this.templates.countByUser(tenantId, userId) >= MAX_PER_USER) throw new Error('REPORT_TEMPLATE_LIMIT_EXCEEDED');

    const created = await this.templates.create({
      tenant_id: tenantId,
      created_by: userId,
      name,
      description,
      resource: input.resource,
      format: input.format,
      definition,
      is_shared: input.is_shared ?? false,
    });
    await this.audit.log({
      tenant_id: tenantId,
      userId,
      action: AUDIT_EVENTS.REPORT_TEMPLATE_CREATED,
      entity: 'report_template',
      entityId: created.id,
      metadata: { name, resource: input.resource, format: input.format, is_shared: created.is_shared },
    }).catch(() => undefined);
    return created;
  }

  async list(tenantId: string, userId: string, resource?: string): Promise<SavedReportTemplate[]> {
    await this.db.setTenant(tenantId);
    if (resource !== undefined && !RESOURCES.includes(resource as ExportResource)) throw new Error('INVALID_REPORT_TEMPLATE_RESOURCE');
    return this.templates.list(tenantId, userId, resource);
  }

  async getById(tenantId: string, userId: string, id: string): Promise<SavedReportTemplate> {
    await this.db.setTenant(tenantId);
    const template = await this.templates.findById(id, tenantId, userId);
    if (!template) throw new Error('REPORT_TEMPLATE_NOT_FOUND');
    return template;
  }

  async update(tenantId: string, userId: string, id: string, patch: UpdateSavedReportTemplateInput): Promise<SavedReportTemplate> {
    await this.db.setTenant(tenantId);
    const existing = await this.templates.findById(id, tenantId, userId);
    if (!existing || existing.created_by !== userId) throw new Error('REPORT_TEMPLATE_NOT_FOUND');

    const name = patch.name === undefined ? existing.name : this.validateName(patch.name);
    if (name !== existing.name && await this.templates.existsName(tenantId, userId, name, id)) throw new Error('REPORT_TEMPLATE_NAME_EXISTS');
    const resource = patch.resource ?? existing.resource;
    const format = patch.format ?? existing.format;
    const definition = this.normalizeDefinition(name, resource, format, patch.definition ?? existing.definition);
    if (this.payloadSize(definition) > MAX_PAYLOAD_BYTES) throw new Error('REPORT_TEMPLATE_PAYLOAD_TOO_LARGE');
    const description = patch.description === undefined ? existing.description : this.validateDescription(patch.description ?? undefined);

    const updated = await this.templates.update(id, tenantId, userId, {
      name,
      description,
      resource,
      format,
      definition,
      is_shared: patch.is_shared,
    });
    if (!updated) throw new Error('REPORT_TEMPLATE_NOT_FOUND');
    await this.audit.log({
      tenant_id: tenantId,
      userId,
      action: AUDIT_EVENTS.REPORT_TEMPLATE_UPDATED,
      entity: 'report_template',
      entityId: id,
      metadata: { fields: Object.keys(patch) },
    }).catch(() => undefined);
    return updated;
  }

  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    await this.db.setTenant(tenantId);
    const existing = await this.templates.findById(id, tenantId, userId);
    if (!existing || existing.created_by !== userId) throw new Error('REPORT_TEMPLATE_NOT_FOUND');
    if (!(await this.templates.remove(id, tenantId, userId))) throw new Error('REPORT_TEMPLATE_NOT_FOUND');
    await this.audit.log({
      tenant_id: tenantId,
      userId,
      action: AUDIT_EVENTS.REPORT_TEMPLATE_DELETED,
      entity: 'report_template',
      entityId: id,
      metadata: { name: existing.name },
    }).catch(() => undefined);
  }

  private normalizeDefinition(name: string, resource: ExportResource, format: ExportFormat, definition: ReportDefinition): ReportDefinition {
    if (!RESOURCES.includes(resource)) throw new Error('INVALID_REPORT_TEMPLATE_RESOURCE');
    if (!FORMATS.includes(format)) throw new Error('INVALID_REPORT_TEMPLATE_FORMAT');
    if (!definition || typeof definition !== 'object') throw new Error('INVALID_REPORT_TEMPLATE_DEFINITION');
    const normalized = {
      ...definition,
      id: definition.id || `template-${Date.now()}`,
      name,
      resource,
      format,
    } as ReportDefinition;
    try {
      this.reportBuilder.validate(normalized);
    } catch (error) {
      throw new Error((error as Error).message);
    }
    return normalized;
  }

  private validateName(value: string): string {
    const name = (value ?? '').trim();
    if (!name || name.length > MAX_NAME_LENGTH) throw new Error('INVALID_REPORT_TEMPLATE_NAME');
    return name;
  }

  private validateDescription(value?: string): string | undefined {
    if (value === undefined) return undefined;
    const description = value.trim();
    if (description.length > MAX_DESCRIPTION_LENGTH) throw new Error('INVALID_REPORT_TEMPLATE_DESCRIPTION');
    return description || undefined;
  }

  private payloadSize(value: unknown): number {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  }
}
