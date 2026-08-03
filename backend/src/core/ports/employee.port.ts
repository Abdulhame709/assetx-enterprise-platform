/**
 * EmployeeRepository port — abstract data access for employees.
 * PII: name/email Confidential, phone Restricted (ADL-009).
 */
import { Employee } from '../entities/employee.entity';

export interface CreateEmployeeInput {
  tenant_id: string;
  name: string;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface UpdateEmployeeInput {
  name?: string;
  department?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface EmployeePort {
  create(input: CreateEmployeeInput): Promise<Employee>;
  update(id: string, tenantId: string, input: UpdateEmployeeInput): Promise<Employee | null>;
  findById(id: string, tenantId: string): Promise<Employee | null>;
  list(tenantId: string): Promise<Employee[]>;
  softDelete(id: string, tenantId: string): Promise<boolean>;
  /** Count assets in an employee's custody (protect against delete if needed). */
  countAssets(id: string, tenantId: string): Promise<number>;
}
