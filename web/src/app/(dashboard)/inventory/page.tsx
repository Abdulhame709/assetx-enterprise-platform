'use client';

/**
 * Inventory — operational cycle list (real backend contract).
 * Each row = one cycle with its computed summary (progress/verified counts),
 * not a static page. Create → snapshot; Open → /inventory/[id].
 */
import Link from 'next/link';
import { useState } from 'react';
import { ClipboardList, Plus, ArrowRight, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useToast } from '@/components/ui/Toast';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';
import { useCycles } from '@/features/inventory/use-inventory';
import { CycleFormModal } from '@/features/inventory/components/CycleFormModal';
import { CycleStatus } from '@/features/inventory/api';

const CYCLE_TONE: Record<CycleStatus, BadgeTone> = {
  new: 'neutral',
  in_progress: 'warning',
  closed: 'success',
};

function formatDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString() : '—';
}

export default function InventoryPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const state = useCycles();
  const toast = useToast();
  const { label } = useI18n();

  return (
    <div>
      <PageHeader
        title="Inventory Cycles"
        subtitle={`${state.data?.length ?? 0} cycle(s)`}
        actions={
          <PermissionGate permission={PERMISSIONS.INVENTORY_CREATE}>
            <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New Cycle
            </Button>
          </PermissionGate>
        }
      />

      <Card className="p-0">
        <CardBody className="p-0">
          {state.status === 'loading' && <LoadingState rows={4} />}
          {state.status === 'error' && <ErrorState message={humanError(state.error)} onRetry={state.reload} />}
          {state.status === 'success' && state.data && state.data.length === 0 && (
            <EmptyState
              title="No inventory cycles yet"
              description="Create a cycle to snapshot your active assets and start counting."
              actionLabel="Create cycle"
              onAction={() => setCreateOpen(true)}
            />
          )}
          {state.status === 'success' && state.data && state.data.length > 0 && (
            <div className="divide-y divide-line">
              {state.data.map(({ cycle, summary }) => {
                const total = summary?.expected_assets ?? 0;
                const done = summary?.inventoried ?? 0;
                const verifiedText = summary ? `${done}/${total} counted · ${summary.completion}% complete` : 'summary unavailable';
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                  <div key={cycle.id} className="flex flex-wrap items-center gap-4 px-4 py-3 hover:bg-surface-muted/60">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted text-ink-muted">
                      <ClipboardList className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">Cycle {cycle.year}</span>
                        <Badge tone={CYCLE_TONE[cycle.status]}>{label(cycle.status)}</Badge>
                        {cycle.status === 'closed' && <CheckCircle2 className="h-4 w-4 text-success" />}
                      </div>
                      <p className="mt-0.5 text-xs text-ink-faint">
                        Started {formatDate(cycle.start_date)} · {cycle.end_date ? `Closed ${formatDate(cycle.end_date)}` : 'Not closed'}
                        {' · '}
                        <Link href={`/inventory/${cycle.id}`} className="text-brand hover:underline">{verifiedText}</Link>
                      </p>
                    </div>
                    {summary && (
                      <div className="w-40 shrink-0">
                        <div className="mb-1 flex justify-between text-xs text-ink-faint">
                          <span>{done}/{total}</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                    <Link href={`/inventory/${cycle.id}`}>
                      <Button variant="secondary" size="sm">
                        Open <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {createOpen && (
        <CycleFormModal
          open
          onClose={() => setCreateOpen(false)}
          onCreated={(cyc, snapshotCount) => {
            toast.success('Cycle created', `Cycle ${cyc.year} — ${snapshotCount} asset(s) snapshotted.`);
            setCreateOpen(false);
            state.reload();
          }}
        />
      )}
    </div>
  );
}
