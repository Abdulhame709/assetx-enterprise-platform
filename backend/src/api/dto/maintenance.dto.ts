import { MaintenancePriority } from '../../core/entities/maintenance.entity';

export interface CreateMaintenanceOrderDto {
  maintenance_type?: string;
  technician_name?: string;
  technician_contact?: string;
  next_maintenance_date?: string;
  priority?: MaintenancePriority;
}

export interface CompleteMaintenanceOrderDto {
  end_date?: string;
  cost?: number;
  next_maintenance_date?: string;
}
