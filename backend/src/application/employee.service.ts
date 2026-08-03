/**
 * EmployeeService — application use cases for employees (ENT-EMPLOYEE).
 * Reference: FRS FR-EMP-* · Entity Spec §5.11 · PII (ADL-009)
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import {
  EmployeePort,
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from '../core/ports/employee.port';
import { Employee } from '../core/entities/employee.entity';
import { DATABASE_PORT, EMPLOYEE_PORT } from '../core/ports/tokens';

@Injectable()
export class EmployeeService {
  constructor(
    @Inject(EMPLOYEE_PORT) private readonly employees: EmployeePort,
    @Inject(DATABASE_PORT) private readonly db: DatabasePort,
  ) {}

  async create(input: CreateEmployeeInput): Promise<Employee> {
    await this.db.setTenant(input.tenant_id);
    if (!input.name || input.name.trim().length < 2) throw new Error('NAME_INVALID');
    return this.employees.create(input);
  }

  async update(id: string, tenantId: string, input: UpdateEmployeeInput): Promise<Employee | null> {
    await this.db.setTenant(tenantId);
    const existing = await this.employees.findById(id, tenantId);
    if (!existing) throw new Error('EMPLOYEE_NOT_FOUND');
    return this.employees.update(id, tenantId, input);
  }

  async getById(id: string, tenantId: string): Promise<Employee | null> {
    await this.db.setTenant(tenantId);
    return this.employees.findById(id, tenantId);
  }

  async list(tenantId: string): Promise<Employee[]> {
    await this.db.setTenant(tenantId);
    return this.employees.list(tenantId);
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.db.setTenant(tenantId);
    const existing = await this.employees.findById(id, tenantId);
    if (!existing) throw new Error('EMPLOYEE_NOT_FOUND');
    const assets = await this.employees.countAssets(id, tenantId);
    if (assets > 0) throw new Error('EMPLOYEE_HAS_ASSETS');
    await this.employees.softDelete(id, tenantId);
  }
}
