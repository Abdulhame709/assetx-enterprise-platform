'use client';

import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { intlLocale } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

/**
 * Unified MetricCard component with warm, sophisticated design.
 * Replaces 6 duplicate implementations across the app.
 */

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type MetricCardProps = {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Metric label (e.g. "Total Assets") */
  label: string;
  /** Metric value (pre-formatted, e.g. "1,234") */
  value: string | number;
  /** Visual tone */
  tone?: Tone;
  /** Optional subtitle below the value */
  subtitle?: string;
  /** Optional trend indicator */
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
  /** Optional action button/link */
  action?: ReactNode;
  /** Variant style */
  variant?: 'default' | 'compact' | 'elevated';
  /** Optional click handler */
  onClick?: () => void;
};

const toneStyles: Record<Tone, { bg: string; text: string; iconBg: string }> = {
  brand: {
    bg: 'bg-surface',
    text: 'text-brand',
    iconBg: 'bg-brand-soft text-brand',
  },
  success: {
    bg: 'bg-surface',
    text: 'text-success',
    iconBg: 'bg-success/10 text-success',
  },
  warning: {
    bg: 'bg-surface',
    text: 'text-warning',
    iconBg: 'bg-warning/10 text-warning',
  },
  danger: {
    bg: 'bg-surface',
    text: 'text-danger',
    iconBg: 'bg-danger/10 text-danger',
  },
  info: {
    bg: 'bg-surface',
    text: 'text-info',
    iconBg: 'bg-info/10 text-info',
  },
  neutral: {
    bg: 'bg-surface',
    text: 'text-ink',
    iconBg: 'bg-surface-muted text-ink-muted',
  },
};

const variantStyles = {
  default: 'rounded-xl border border-line shadow-card hover:shadow-card-hover transition-shadow',
  compact: 'rounded-lg border border-line shadow-card',
  elevated: 'rounded-xl border-0 shadow-pop',
};

export function MetricCard({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
  subtitle,
  trend,
  action,
  variant = 'default',
  onClick,
}: MetricCardProps) {
  const { locale } = useI18n();
  const styles = toneStyles[tone];
  const containerClass = variantStyles[variant];
  const isClickable = !!onClick;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-lg ${styles.iconBg} transition-transform ${
            isClickable ? 'group-hover:scale-110' : ''
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.5} />
        </span>
        <div className="flex-1 text-end rtl:text-start">
          <p className={`text-3xl font-bold tabular-nums ${styles.text} leading-none`}>
            {typeof value === 'number' ? value.toLocaleString(intlLocale(locale)) : value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-semibold ${
              trend.direction === 'up'
                ? 'text-success'
                : trend.direction === 'down'
                  ? 'text-danger'
                  : 'text-ink-muted'
            }`}
          >
            {trend.direction === 'up' && '↑'}
            {trend.direction === 'down' && '↓'}
            {trend.value}
          </div>
        )}
        {action && <div>{action}</div>}
      </div>
    </>
  );

  if (isClickable) {
    return (
      <button
        onClick={onClick}
        className={`group ${styles.bg} ${containerClass} p-4 text-start rtl:text-end transition-all hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand/30`}
      >
        {content}
      </button>
    );
  }

  return <div className={`${styles.bg} ${containerClass} p-4`}>{content}</div>;
}

/**
 * Compact variant for tight spaces
 */
export function MetricCardCompact(props: Omit<MetricCardProps, 'variant'>) {
  return <MetricCard {...props} variant="compact" />;
}

/**
 * Elevated variant with no border and deeper shadow
 */
export function MetricCardElevated(props: Omit<MetricCardProps, 'variant'>) {
  return <MetricCard {...props} variant="elevated" />;
}
