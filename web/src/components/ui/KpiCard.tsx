import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { cn } from '@/lib/cn';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  delta?: number;
  deltaLabel?: string;
  tone?: 'success' | 'danger' | 'warning' | 'info' | 'neutral';
}

/** KpiCard — summary card for dashboards (label + value + optional trend). */
export function KpiCard({ label, value, icon: Icon, delta, deltaLabel, tone = 'neutral' }: KpiCardProps) {
  const iconBg: Record<string, string> = {
    success: 'bg-success/10 text-success',
    danger: 'bg-danger/10 text-danger',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
    neutral: 'bg-surface-muted text-ink-muted',
  };
  return (
    <Card className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
        {delta !== undefined && (
          <div className="mt-1 flex items-center gap-1 text-xs">
            <span className={cn('inline-flex items-center gap-0.5', delta >= 0 ? 'text-success' : 'text-danger')}>
              {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {Math.abs(delta)}%
            </span>
            {deltaLabel && <span className="text-ink-faint">{deltaLabel}</span>}
          </div>
        )}
      </div>
      {Icon && (
        <span className={cn('rounded-xl p-2.5', iconBg[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      )}
    </Card>
  );
}
