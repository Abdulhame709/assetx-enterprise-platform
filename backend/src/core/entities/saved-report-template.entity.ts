/**
 * Persisted report-definition template.
 * This is intentionally separate from ReportTemplate, which only describes
 * printable presentation styling for a single export.
 */
import { ExportFormat, ExportResource } from './export.entity';
import { ReportDefinition } from './report.entity';

export interface SavedReportTemplate {
  id: string;
  tenant_id: string;
  created_by: string;
  name: string;
  description: string | null;
  resource: ExportResource;
  format: ExportFormat;
  definition: ReportDefinition;
  is_shared: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export type CreateSavedReportTemplateInput = {
  tenant_id: string;
  created_by: string;
  name: string;
  description?: string;
  resource: ExportResource;
  format: ExportFormat;
  definition: ReportDefinition;
  is_shared?: boolean;
};

export type UpdateSavedReportTemplateInput = {
  name?: string;
  description?: string | null;
  resource?: ExportResource;
  format?: ExportFormat;
  definition?: ReportDefinition;
  is_shared?: boolean;
};
