import { AsyncState, useAsync } from '@/lib/use-async';
import { MaintenanceOrder, MaintenanceWorkflowStatus, getMaintenanceOrders } from './api';

export function useMaintenanceOrders(status?: MaintenanceWorkflowStatus): AsyncState<MaintenanceOrder[]> {
  return useAsync(() => getMaintenanceOrders(status), [status]);
}
