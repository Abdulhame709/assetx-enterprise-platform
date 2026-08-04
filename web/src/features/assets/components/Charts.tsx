'use client';

import { AnalyticsBucket } from '../types';

const PALETTE = ['#1d4ed8', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#64748b'];

/** Simple horizontal bar distribution (category/location). */
export function BarList({ data, max }: { data: AnalyticsBucket[]; max?: number }) {
  const top = max ?? Math.max(...data.map((d) => d.count), 1);
  return (
    <ul className="space-y-2">
      {data.map((d, i) => (
        <li key={d.name}>
          <div className="mb-0.5 flex items-center justify-between text-xs">
            <span className="text-ink-muted">{d.name}</span>
            <span className="font-medium text-ink">{d.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-surface-muted">
            <div
              className="h-full rounded"
              style={{ width: `${(d.count / top) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Donut chart for lifecycle distribution (SVG). Accepts {name,count} buckets. */
export function Donut({ data }: { data: AnalyticsBucket[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="h-32 w-32">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--ax-surface-muted, #f3f4f6)" strokeWidth="16" />
        {data.map((d, i) => {
          const frac = d.count / total;
          const dash = frac * c;
          const el = (
            <circle
              key={d.name}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="16"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <ul className="space-y-1 text-xs">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="text-ink-muted capitalize">{d.name.replace(/_/g, ' ')}</span>
            <span className="ms-auto font-medium text-ink">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
