'use client';

/**
 * Compliance (Slice 4) — honest read-only dashboard over the REAL backend:
 *   /compliance/health (8 live checks) + /compliance/integrity (weighted score).
 * Anything the backend does not provide (controls/policies/violations/
 * remediation) is stated plainly — never fabricated.
 */
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/states';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { toTitle } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useCompliance } from '@/features/compliance/use-compliance';
import { ComplianceCheck, IntegrityCheck } from '@/features/compliance/api';
import { useI18n } from '@/lib/i18n';

function StatusBadge({ status, text }: { status: 'OK' | 'WARNING'; text: (key: string) => string }) {
  return status === 'OK'
    ? <Badge tone="success">{text('compliance.ok')}</Badge>
    : <Badge tone="warning">{text('compliance.warning')}</Badge>;
}

/** SVG score ring — same visual language as the dashboard donut. */
function ScoreRing({ score, text }: { score: number; text: (key: string) => string }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(100, score)) / 100;
  const tone = score >= 80 ? 'var(--ax-success, #16a34a)' : score >= 50 ? 'var(--ax-warning, #d97706)' : 'var(--ax-danger, #dc2626)';
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 110 110" className="h-28 w-28">
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--ax-line, #e5e7eb)" strokeWidth="12" />
        <circle
          cx="55" cy="55" r={r} fill="none"
          stroke={tone} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${frac * c} ${c - frac * c}`}
          transform="rotate(-90 55 55)"
        />
        <text x="55" y="55" textAnchor="middle" dominantBaseline="central" className="fill-ink text-2xl font-semibold">
          {score}
        </text>
      </svg>
      <div>
        <p className="text-sm font-medium text-ink">{text('compliance.integrityScore')}</p>
        <p className="mt-0.5 max-w-52 text-xs text-ink-muted">
          {text('compliance.scoreDescription')}
        </p>
      </div>
    </div>
  );
}

function HealthCard({ c, text, locale }: { c: ComplianceCheck; text: (key: string, fallback?: string) => string; locale: 'en' | 'ar' }) {
  const warn = c.status === 'WARNING';
  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-xl border p-3', warn ? 'border-warning/40 bg-warning/5' : 'border-line')}>
      <div className="flex items-center gap-2.5">
        {warn
          ? <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          : <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
        <div>
          <p className="text-sm font-medium text-ink">{text(`compliance.check.${c.check}`, toTitle(c.check))}</p>
          <p className="text-xs text-ink-faint">{c.count.toLocaleString(locale)} {text('compliance.items')}</p>
        </div>
      </div>
      <StatusBadge status={c.status} text={text} />
    </div>
  );
}

function IntegrityRow({ c, text, locale }: { c: IntegrityCheck; text: (key: string, fallback?: string) => string; locale: 'en' | 'ar' }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 py-2 last:border-0">
      <span className="text-sm text-ink">{text(`compliance.check.${c.check}`, toTitle(c.check))}</span>
      <div className="flex items-center gap-2 text-xs text-ink-faint">
        <span>{text('compliance.count')} {c.count.toLocaleString(locale)}</span>
        <span>·</span>
        <span>{text('compliance.weight')} {c.weight}</span>
        <StatusBadge status={c.status} text={text} />
      </div>
    </div>
  );
}

export default function CompliancePage() {
  const state = useCompliance();
  const { t, locale } = useI18n();

  return (
    <PermissionGate
      permission={PERMISSIONS.COMPLIANCE_VIEW}
      fallback={<EmptyState title={t('compliance.noAccess')} description={t('compliance.noAccessDesc')} />}
    >
      <PageHeader
        title={t('compliance.title')}
        subtitle={t('compliance.subtitle')}
      />

      <AsyncBoundary state={state}>
        {({ health, integrity }) => (
          <>
            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-1">
                <CardBody><ScoreRing score={integrity.score} text={t} /></CardBody>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader title={t('compliance.integrityChecks')} subtitle={t('compliance.integrityChecksSubtitle')} />
                <CardBody>
                  {integrity.checks.length === 0
                    ? <EmptyState title={t('compliance.noIntegrityChecks')} />
                    : integrity.checks.map((c) => <IntegrityRow key={c.check} c={c} text={t} locale={locale} />)}
                </CardBody>
              </Card>
            </div>

            <Card className="mb-4">
              <CardHeader
                title={t('compliance.healthChecks')}
                subtitle={t('compliance.healthChecksSubtitle')}
                actions={<ShieldCheck className="h-4 w-4 text-ink-faint" />}
              />
              <CardBody>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {health.checks.map((c) => <HealthCard key={c.check} c={c} text={t} locale={locale} />)}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <EmptyState
                  title={t('compliance.controlsUnavailable')}
                  description={t('compliance.controlsUnavailableDesc')}
                />
              </CardBody>
            </Card>
          </>
        )}
      </AsyncBoundary>
    </PermissionGate>
  );
}
