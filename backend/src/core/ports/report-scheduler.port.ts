/**
 * ReportScheduler port — abstracts how scheduled report triggers are delivered.
 * ScheduledReportService depends on this abstraction so the trigger can later be
 * a Cron, Queue, K8s, or Cloud scheduler without changing the service.
 * Reference: Task T4 (approved design)
 */
export interface ReportSchedule {
  /** report resource to generate (assets/movements/inventory/audit/dashboard) */
  resource: string;
  /** export format (pdf/xlsx/csv) */
  format: string;
  /** how many rows to cap */
  limit?: number;
}

export interface ReportScheduler {
  /** Called by the scheduler each trigger with the report to generate. */
  run(report: ReportSchedule, tenantId: string): Promise<void>;
}
