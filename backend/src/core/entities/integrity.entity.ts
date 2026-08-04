/**
 * Integrity entity — data integrity check result (Phase 11, Task T2).
 * Reference: Business Spec §6 (compliance/integrity) · Micro Design Review T2
 */

export type IntegrityStatus = 'OK' | 'WARNING';

export interface IntegrityCheck {
  check: string;
  status: IntegrityStatus;
  count: number;
  weight: number;   // weight deducted per affected unit (0 when OK)
}

export interface IntegrityResult {
  tenant_id: string;
  score: number;         // 0-100
  checks: IntegrityCheck[];
  overall: IntegrityStatus;
}

export interface IntegrityPort {
  check(tenantId: string): Promise<IntegrityResult>;
}
