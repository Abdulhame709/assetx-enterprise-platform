import { http } from '@/lib/api/client';
import type { ReportDefinition, ReportFormat, ReportResource } from './api';

export interface ReportTemplateRecord {
  id: string;
  tenant_id: string;
  created_by: string;
  name: string;
  description: string | null;
  resource: ReportResource;
  format: ReportFormat;
  definition: ReportDefinition;
  is_shared: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CreateReportTemplateInput {
  name: string;
  description?: string;
  resource: ReportResource;
  format: ReportFormat;
  definition: ReportDefinition;
  is_shared?: boolean;
}

export type UpdateReportTemplateInput = Partial<Omit<CreateReportTemplateInput, 'definition'>> & {
  definition?: ReportDefinition;
};

export async function listReportTemplates(resource?: ReportResource): Promise<ReportTemplateRecord[]> {
  const query = resource ? `?resource=${encodeURIComponent(resource)}` : '';
  return (await http.get<ReportTemplateRecord[]>(`/report-templates${query}`)) ?? [];
}

export function getReportTemplate(id: string): Promise<ReportTemplateRecord> {
  return http.get<ReportTemplateRecord>(`/report-templates/${encodeURIComponent(id)}`);
}

export function createReportTemplate(input: CreateReportTemplateInput): Promise<ReportTemplateRecord> {
  return http.post<ReportTemplateRecord>('/report-templates', input);
}

export function updateReportTemplate(id: string, input: UpdateReportTemplateInput): Promise<ReportTemplateRecord> {
  return http.patch<ReportTemplateRecord>(`/report-templates/${encodeURIComponent(id)}`, input);
}

export function deleteReportTemplate(id: string): Promise<{ message: string }> {
  return http.del<{ message: string }>(`/report-templates/${encodeURIComponent(id)}`);
}
