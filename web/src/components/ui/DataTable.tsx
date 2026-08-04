'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { LoadingState, EmptyState, ErrorState } from './states';

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  empty?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  empty,
  onRetry,
  className,
}: DataTableProps<T>) {
  if (loading) return <LoadingState rows={5} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (rows.length === 0) return empty ? <>{empty}</> : <EmptyState />;

  const alignCls = { left: 'text-left', center: 'text-center', right: 'text-right' };

  return (
    <div className={cn('overflow-x-auto rounded-xl border border-line', className)}>
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                className={cn('px-3 py-2.5 font-semibold', alignCls[c.align ?? 'left'])}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-surface-muted/50">
              {columns.map((c) => (
                <td key={c.key} className={cn('px-3 py-2.5 text-ink', alignCls[c.align ?? 'left'])}>
                  {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
