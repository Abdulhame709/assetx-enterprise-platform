/**
 * EmployeeRepository — infrastructure implementation of EmployeePort.
 * Reference: Data Dictionary (DOC-24) TB-EMPLOYEE · PII (ADL-009)
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../../core/ports/database.port';
import { Employee } from '../../core/entities/employee.entity';
import {
  EmployeePort,
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from '../../core/ports/employee.port';
import { DATABASE_PORT } from '../../core/ports/tokens';

@Injectable()
export class EmployeeRepository implements EmployeePort {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async create(input: CreateEmployeeInput): Promise<Employee> {
    const { rows } = await this.db.query<Employee>(
      `INSERT INTO employees (tenant_id, name, department, phone, email)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.tenant_id, input.name, input.department ?? null, input.phone ?? null, input.email ?? null],
    );
    return rows[0];
  }

  async update(id: string, tenantId: string, input: UpdateEmployeeInput): Promise<Employee | null> {
    const { rows } = await this.db.query<Employee>(
      `UPDATE employees SET
         name = COALESCE($3, name),
         department = COALESCE($4, department),
         phone = COALESCE($5, phone),
         email = COALESCE($6, email),
         updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND is_active = true
       RETURNING *`,
      [id, tenantId, input.name ?? null, input.department ?? null, input.phone ?? null, input.email ?? null],
    );
    return rows[0] ?? null;
  }

  async findById(id: string, tenantId: string): Promise<Employee | null> {
    const { rows } = await this.db.query<Employee>(
      `SELECT * FROM employees WHERE id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
      [id, tenantId],
    );
    return rows[0] ?? null;
  }

  async list(tenantId: string): Promise<Employee[]> {
    const { rows } = await this.db.query<Employee>(
      `SELECT * FROM employees WHERE tenant_id = $1 AND is_active = true ORDER BY name`,
      [tenantId],
    );
    return rows;
  }

  async softDelete(id: string, tenantId: string): Promise<boolean> {
    const { rowCount } = await this.db.query(
      `UPDATE employees SET is_active = false, updated_at = now()
       WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
    return (rowCount ?? 0) > 0;
  }

  async countAssets(id: string, tenantId: string): Promise<number> {
    const { rows } = await this.db.query<{ c: string }>(
      `SELECT count(*) AS c FROM assets WHERE employee_id = $1 AND tenant_id = $2 AND is_active = true`,
      [id, tenantId],
    );
    return Number(rows[0]?.c ?? 0);
  }
}
