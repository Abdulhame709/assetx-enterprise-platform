'use client';

/** SkipLink — keyboard-first skip-to-content link (accessibility). */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:start-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-white"
    >
      Skip to content
    </a>
  );
}
