/**
 * Compliance API layer (Slice 4) — REAL read-only contracts only:
 *   GET /compliance/health    → { tenant_id, checks: [{check,status,count}] }
 *   GET /compliance/integrity → { tenant_id, score, checks: [{check,status,count,weight}] }
 * Controls / policies / violations / remediation endpoints do NOT exist on the
 * backend and are therefore NOT fabricated in the UI (explicit honest note on the page).
 */
import { http } from '@/lib/api/client';

export interface ComplianceCheck {
  check: string;
  status: 'OK' | 'WARNING';
  count: number;
}

export interface IntegrityCheck extends ComplianceCheck {
  weight: number;
}

export interface ComplianceHealth {
  checks: ComplianceCheck[];
}

export interface ComplianceIntegrity {
  score: number;
  checks: IntegrityCheck[];
}

function normalizeChecks(raw: unknown): Record<string, unknown>[] {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (Array.isArray(o.checks)) return o.checks as Record<string, unknown>[];
  }
  return [];
}

const toStatus = (v: unknown): 'OK' | 'WARNING' => (String(v).toUpperCase() === 'WARNING' ? 'WARNING' : 'OK');

export function mapHealth(raw: unknown): ComplianceHealth {
  return {
    checks: normalizeChecks(raw).map((c) => ({
      check: String(c.check ?? ''),
      status: toStatus(c.status),
      count: Number(c.count ?? 0) || 0,
    })),
  };
}

export function mapIntegrity(raw: unknown): ComplianceIntegrity {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    score: Number(o.score ?? 0) || 0,
    checks: normalizeChecks(raw).map((c) => ({
      check: String(c.check ?? ''),
      status: toStatus(c.status),
      count: Number(c.count ?? 0) || 0,
      weight: Number(c.weight ?? 0) || 0,
    })),
  };
}

export async function getComplianceHealth(): Promise<ComplianceHealth> {
  const raw = await http.get<unknown>('/compliance/health');
  return mapHealth(raw);
}

export async function getComplianceIntegrity(): Promise<ComplianceIntegrity> {
  const raw = await http.get<unknown>('/compliance/integrity');
  return mapIntegrity(raw);
}
