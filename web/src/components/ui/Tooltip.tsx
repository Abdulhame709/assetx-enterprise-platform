'use client';

import { ReactNode, useRef, useState } from 'react';

/** Tooltip — lightweight accessible hover/focus tooltip. */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => { timer.current = setTimeout(() => setShow(true), 300); }}
      onMouseLeave={() => { if (timer.current) clearTimeout(timer.current); setShow(false); }}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-surface shadow-pop"
        >
          {content}
        </span>
      )}
    </span>
  );
}
