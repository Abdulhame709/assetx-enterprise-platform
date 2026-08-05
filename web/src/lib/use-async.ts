'use client';

/**
 * Unified async state (Phase UX-1).
 * Every data-loading hook returns the same shape: { data, status, error, reload }.
 * status ∈ 'loading' | 'empty' | 'success' | 'error' — consumed by AsyncBoundary
 * so all pages render identical Loading/Empty/Error/Retry states with no code dup.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncStatus = 'loading' | 'empty' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  status: AsyncStatus;
  error: string | null;
  reload: () => void;
}

/** isEmpty — whether a data value should be treated as "empty" (override per hook). */
type IsEmpty<T> = (data: T) => boolean;

export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options?: { isEmpty?: IsEmpty<T>; initial?: T },
): AsyncState<T> {
  const [data, setData] = useState<T | null>(options?.initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);

  const isEmpty = options?.isEmpty;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setError(null);
    fetcher()
      .then((res) => {
        if (!active) return;
        setData(res);
        setStatus(isEmpty ? (isEmpty(res) ? 'empty' : 'success') : res == null ? 'empty' : 'success');
      })
      .catch((e) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Something went wrong');
        setStatus('error');
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, status, error, reload };
}
