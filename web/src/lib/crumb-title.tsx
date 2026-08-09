'use client';

/**
 * CrumbTitle (P2 fix UX-07) — lets a detail page publish the human title of
 * the entity it is showing (e.g. "Laptop Dell") so the shell's breadcrumb
 * can replace the opaque id segment with a real name.
 *
 * The provider lives in AppShell (sibling scope over BOTH Topbar and page
 * content — a provider inside a page cannot reach the Topbar above it).
 * Pages publish via usePublishCrumbTitle() at their top level, sourced only
 * from loaded, real data; the shell falls back to 'Details' — a name is
 * never invented.
 */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface CrumbTitleApi {
  title: string | null;
  setTitle: (t: string | null) => void;
}

const CrumbTitleContext = createContext<CrumbTitleApi>({ title: null, setTitle: () => undefined });

export function CrumbTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return (
    <CrumbTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </CrumbTitleContext.Provider>
  );
}

export function useCrumbTitle(): string | null {
  return useContext(CrumbTitleContext).title;
}

/** Publish (and auto-clear on unmount/route change) the current entity title. */
export function usePublishCrumbTitle(title: string | null): void {
  const { setTitle } = useContext(CrumbTitleContext);
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
}
