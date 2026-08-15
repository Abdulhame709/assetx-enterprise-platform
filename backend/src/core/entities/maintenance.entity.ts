/**
 * MaintenanceOrder — aggregate root for the Maintenance bounded context.
 * Mirrors the legacy tblMaintenance fields while adding a controlled workflow.
 */
export type MaintenanceWorkflowStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';

export interface MaintenanceOrder {
  id: string;
  tenant_id: string;
  asset_id: string;
  maintenance_code: string | null;
  maintenance_type: string | null;
  cost: number | null;
  technician_name: string | null;
  technician_contact: string | null;
  start_date: string | null;
  end_date: string | null;
  next_maintenance_date: string | null;
  status_id: string | null;
  previous_status_id: string | null;
  priority: MaintenancePriority | null;
  workflow_status: MaintenanceWorkflowStatus;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
  asset_name?: string;
  asset_code?: string;
}
