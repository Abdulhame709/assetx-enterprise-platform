'use client';

/**
 * Compliance data hooks (Slice 4) — both endpoints are cheap; the pair loads
 * together so the page renders one coherent snapshot.
 */
import { useAsync, AsyncState } from '@/lib/use-async';
import { getComplianceHealth, getComplianceIntegrity, ComplianceHealth, ComplianceIntegrity } from './api';

export interface ComplianceData {
  health: ComplianceHealth;
  integrity: ComplianceIntegrity;
}

export function useCompliance(): AsyncState<ComplianceData> {
  return useAsync<ComplianceData>(async () => {
    const [health, integrity] = await Promise.all([getComplianceHealth(), getComplianceIntegrity()]);
    return { health, integrity };
  }, []);
}
