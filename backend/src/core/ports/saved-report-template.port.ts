import {
  CreateSavedReportTemplateInput,
  SavedReportTemplate,
  UpdateSavedReportTemplateInput,
} from '../entities/saved-report-template.entity';

export interface SavedReportTemplatePort {
  create(input: CreateSavedReportTemplateInput): Promise<SavedReportTemplate>;
  findById(id: string, tenantId: string, userId: string): Promise<SavedReportTemplate | null>;
  list(tenantId: string, userId: string, resource?: string): Promise<SavedReportTemplate[]>;
  update(id: string, tenantId: string, userId: string, patch: UpdateSavedReportTemplateInput): Promise<SavedReportTemplate | null>;
  remove(id: string, tenantId: string, userId: string): Promise<boolean>;
  countByUser(tenantId: string, userId: string): Promise<number>;
  existsName(tenantId: string, userId: string, name: string, excludeId?: string): Promise<boolean>;
}
