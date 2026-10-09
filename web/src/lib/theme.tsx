'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeId = 'enterprise' | 'midnight' | 'emerald' | 'graphite';

export interface ThemeOption {
  id: ThemeId;
  labelKey: string;
  descriptionKey: string;
  previewClass: string;
  dark: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: 'enterprise', labelKey: 'theme.enterprise', descriptionKey: 'theme.enterpriseDesc', previewClass: 'theme-preview-enterprise', dark: false },
  { id: 'midnight', labelKey: 'theme.midnight', descriptionKey: 'theme.midnightDesc', previewClass: 'theme-preview-midnight', dark: true },
  { id: 'emerald', labelKey: 'theme.emerald', descriptionKey: 'theme.emeraldDesc', previewClass: 'theme-preview-emerald', dark: false },
  { id: 'graphite', labelKey: 'theme.graphite', descriptionKey: 'theme.graphiteDesc', previewClass: 'theme-preview-graphite', dark: true },
];

const THEME_KEY = 'assetx.theme.v1';
const DEFAULT_THEME: ThemeId = 'enterprise';

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  options: ThemeOption[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeId(value: string | null): value is ThemeId {
  return THEME_OPTIONS.some((item) => item.id === value);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (isThemeId(saved)) setThemeState(saved);
  }, []);

  useEffect(() => {
    const option = THEME_OPTIONS.find((item) => item.id === theme) ?? THEME_OPTIONS[0];
    const root = document.documentElement;
    root.dataset.theme = option.id;
    root.classList.toggle('dark', option.dark);
    root.style.colorScheme = option.dark ? 'dark' : 'light';
  }, [theme]);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_KEY, next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, options: THEME_OPTIONS }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}
