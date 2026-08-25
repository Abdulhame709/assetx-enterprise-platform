'use client';

import { Check, Moon, Sun } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useI18n } from '@/lib/i18n';
import { THEME_OPTIONS, useTheme } from '@/lib/theme';

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  return (
    <Card>
      <CardHeader title={t('settings.themeTitle')} subtitle={t('settings.themeDesc')} />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_OPTIONS.map((option) => {
            const selected = theme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                className={`group rounded-xl border p-3 text-start transition-[border-color,background-color,transform] duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${selected ? 'border-brand bg-brand-soft/25' : 'border-line bg-surface hover:bg-surface-muted'}`}
                aria-pressed={selected}
              >
                <div className={`relative h-16 overflow-hidden rounded-lg border border-line ${option.previewClass}`} aria-hidden="true">
                  <span className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-white/80 text-slate-700 shadow-sm dark:bg-slate-900/70 dark:text-slate-100">
                    {option.dark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
                  </span>
                  <span className="absolute bottom-2 start-2 h-2 w-20 rounded-full bg-white/70" />
                  <span className="absolute bottom-2 start-2 mb-3 h-2 w-12 rounded-full bg-white/45" />
                </div>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{t(option.labelKey)}</p>
                    <p className="mt-1 text-xs leading-5 text-ink-muted">{t(option.descriptionKey)}</p>
                  </div>
                  {selected && <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-white"><Check className="h-4 w-4" aria-hidden="true" /></span>}
                </div>
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
