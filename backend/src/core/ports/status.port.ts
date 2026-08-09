/**
 * StatusRepository port — abstract data access for asset statuses.
 */
import { Status } from '../entities/status.entity';

export interface CreateStatusInput {
  tenant_id: string;
  name: string;
  color?: string | null;
}

export interface UpdateStatusInput {
  name?: string;
  color?: string | null;
}

export interface StatusPort {
  create(input: CreateStatusInput): Promise<Status>;
  update(id: string, tenantId: string, input: UpdateStatusInput): Promise<Status | null>;
  findById(id: string, tenantId: string): Promise<Status | null>;
  list(tenantId: string): Promise<Status[]>;
  existsName(tenantId: string, name: string, excludeId?: string): Promise<boolean>;
  /** Count assets currently using this status (integrity info for callers). */
  countAssets(id: string, tenantId: string): Promise<number>;
}
