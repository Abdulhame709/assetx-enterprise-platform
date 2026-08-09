'use client';

/**
 * Audit data hooks (Slice 4) — stability rule from the /assets storm fix (F-06):
 * deps are JSON keys, never inline objects.
 */
import { useAsync, AsyncState } from '@/lib/use-async';
import { getAuditEvents, getSecurityEvents } from './api';
import { AuditQuery, AuditTab, PagedAudit } from './types';

export function useAuditEvents(tab: AuditTab, query: AuditQuery): AsyncState<PagedAudit> {
  const key = JSON.stringify({ tab, ...query });
  return useAsync<PagedAudit>(() => {
    const parsed = JSON.parse(key) as { tab: AuditTab } & AuditQuery;
    const { tab: t, ...q } = parsed;
    return t === 'security' ? getSecurityEvents(q) : getAuditEvents(q);
  }, [key]);
}
