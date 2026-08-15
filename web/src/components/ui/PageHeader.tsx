import { ReactNode } from 'react';

/** PageHeader — title + subtitle + actions for every screen. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-4 shadow-card md:px-5">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-6 text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
