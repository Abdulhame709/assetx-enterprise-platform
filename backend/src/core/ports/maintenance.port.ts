import {
  MaintenanceOrder,
  MaintenancePriority,
  MaintenanceWorkflowStatus,
} from '../entities/maintenance.entity';

export interface CreateMaintenanceOrderInput {
  tenant_id: string;
  asset_id: string;
  maintenance_code: string;
  maintenance_type?: string;
  technician_name?: string;
  technician_contact?: string;
  next_maintenance_date?: string | null;
  priority?: MaintenancePriority;
  previous_status_id?: string | null;
  created_by?: string | null;
}

export interface CompleteMaintenanceOrderInput {
  end_date?: string;
  cost?: number | null;
  next_maintenance_date?: string | null;
  updated_by: string;
  status_id: string;
}

export interface MaintenancePort {
  create(input: CreateMaintenanceOrderInput): Promise<MaintenanceOrder>;
  findById(id: string, tenantId: string): Promise<MaintenanceOrder | null>;
  list(tenantId: string, workflowStatus?: MaintenanceWorkflowStatus): Promise<MaintenanceOrder[]>;
  listByAsset(assetId: string, tenantId: string): Promise<MaintenanceOrder[]>;
  start(id: string, tenantId: string, maintenanceStatusId: string, updatedBy: string): Promise<MaintenanceOrder | null>;
  complete(id: string, tenantId: string, input: CompleteMaintenanceOrderInput): Promise<MaintenanceOrder | null>;
}
