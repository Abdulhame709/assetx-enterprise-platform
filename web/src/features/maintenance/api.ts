import { http } from '@/lib/api/client';

export type MaintenanceWorkflowStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';

export interface MaintenanceOrder {
  id: string;
  asset_id: string;
  maintenance_code: string | null;
  maintenance_type: string | null;
  cost: number | null;
  technician_name: string | null;
  technician_contact: string | null;
  start_date: string | null;
  end_date: string | null;
  next_maintenance_date: string | null;
  priority: MaintenancePriority | null;
  workflow_status: MaintenanceWorkflowStatus;
  created_at: string;
  asset_name?: string;
  asset_code?: string;
}

export interface CreateMaintenanceOrderInput {
  maintenance_type?: string;
  technician_name?: string;
  technician_contact?: string;
  next_maintenance_date?: string;
  priority?: MaintenancePriority;
}

export interface CompleteMaintenanceOrderInput {
  end_date?: string;
  cost?: number;
  next_maintenance_date?: string;
}

export const getMaintenanceOrders = (status?: MaintenanceWorkflowStatus) =>
  http.get<MaintenanceOrder[]>(`/maintenance${status ? `?status=${encodeURIComponent(status)}` : ''}`);
export const getAssetMaintenanceOrders = (assetId: string) => http.get<MaintenanceOrder[]>(`/assets/${assetId}/maintenance`);
export const createMaintenanceOrder = (assetId: string, input: CreateMaintenanceOrderInput) =>
  http.post<MaintenanceOrder>(`/assets/${assetId}/maintenance`, input);
export const startMaintenanceOrder = (id: string) => http.patch<MaintenanceOrder>(`/maintenance/${id}/start`, {});
export const completeMaintenanceOrder = (id: string, input: CompleteMaintenanceOrderInput) =>
  http.patch<MaintenanceOrder>(`/maintenance/${id}/complete`, input);
