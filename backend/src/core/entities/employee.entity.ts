/**
 * Employee entity — ENT-EMPLOYEE (BC-EMPLOYEE) — Aggregate Root.
 * Reference: Entity Spec (DOC-21) §5.11 · Data Dictionary (DOC-24) TB-EMPLOYEE
 * PII: name/email Confidential, phone Restricted (ADL-009).
 */
export interface Employee {
  id: string;
  tenant_id: string;
  name: string;
  department: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
