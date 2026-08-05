'use client';

import { ReactNode } from 'react';
import { AsyncState } from '@/lib/use-async';
import { LoadingState, EmptyState, ErrorState } from './states';

interface AsyncBoundaryProps<T> {
  state: AsyncState<T>;
  children: (data: T) => ReactNode;
  /** render loading (default skeleton) */
  loading?: ReactNode;
  empty?: ReactNode;
  /** force-empty guard for cases where data presence isn't the signal */
  isEmpty?: (data: T) => boolean;
}

/**
 * AsyncBoundary — single place that renders Loading / Empty / Error(retry) /
 * Success for any useAsync result. Guarantees identical behavior & design across
 * every page (no duplicated state code).
 */
export function AsyncBoundary<T>({ state, children, loading, empty, isEmpty }: AsyncBoundaryProps<T>) {
  if (state.status === 'loading') {
    return loading ?? <LoadingState />;
  }

  if (state.status === 'error') {
    return <ErrorState message={state.error ?? 'Failed to load'} onRetry={state.reload} />;
  }

  if (state.status === 'empty' || (state.data != null && isEmpty && isEmpty(state.data))) {
    return empty ?? <EmptyState />;
  }

  if (state.data == null) return <EmptyState />;

  return <>{children(state.data)}</>;
}
