import { ReactNode } from 'react';

/** PageHeader — title + subtitle + actions for every screen. */
export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-6 text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
