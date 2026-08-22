'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { LayoutGrid, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/auth/session-context';
import type { PermissionKey } from '@/lib/auth/permissions';
import { visibleSections } from '@/lib/navigation';
import { useI18n } from '@/lib/i18n';
import { Modal } from './Modal';
import { Button } from './Button';

export type CommandToolbarVariant = 'default' | 'primary' | 'danger' | 'ghost';

export interface CommandToolbarAction {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  permission?: PermissionKey;
  disabled?: boolean;
  loading?: boolean;
  variant?: CommandToolbarVariant;
  separated?: boolean;
  showLabel?: boolean;
}

interface CommandToolbarProps {
  actions: CommandToolbarAction[];
  label?: string;
  className?: string;
  /** Keep the real permission-filtered all-modules navigator at the end of the command groups. */
  showModuleNavigator?: boolean;
}

const variants: Record<CommandToolbarVariant, string> = {
  default: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
  // Primary commands keep the same dimensions as every other icon; colour is the only emphasis.
  primary: 'bg-brand text-white shadow-sm hover:bg-brand-strong',
  danger: 'text-danger hover:bg-danger/10',
  ghost: 'text-ink-faint hover:bg-surface-muted hover:text-ink',
};

/**
 * Semantic order for Arabic ERP command bars. CSS direction determines whether the
 * first item is rendered at the right (Arabic) or left (English). Unknown actions
 * stay in the neutral workspace group instead of being silently hidden.
 */
const commandRanks: Record<string, number> = {
  add: 10,
  create: 10,
  new: 10,
  copy: 20,
  duplicate: 20,
  edit: 30,
  update: 30,
  delete: 40,
  remove: 40,
  dispose: 40,
  deactivate: 40,
  view: 50,
  preview: 50,
  details: 50,
  'view-assets': 50,
  search: 60,
  'focus-search': 60,
  'toggle-filters': 60,
  refresh: 65,
  first: 70,
  previous: 71,
  next: 72,
  last: 73,
  save: 80,
  print: 90,
  reports: 100,
  report: 100,
  designer: 100,
  'ai-summary': 100,
  export: 110,
  'export-pdf': 110,
  import: 110,
  all: 115,
  modules: 115,
  reset: 130,
  'reset-search': 130,
  undo: 130,
  clear: 130,
  cancel: 140,
  close: 140,
  back: 140,
  exit: 140,
};

function commandRank(id: string): number {
  return commandRanks[id] ?? 75;
}

function commandGroup(id: string): number {
  const rank = commandRank(id);
  if (rank < 50) return 1;
  if (rank < 70) return 2;
  if (rank < 80) return 3;
  if (rank < 90) return 4;
  if (rank < 110) return 5;
  if (rank < 120) return 6;
  return 7;
}

/**
 * Dense, permission-aware page commands inspired by desktop accounting toolbars.
 * Every action must provide a real click handler or route; there are no inert buttons.
 */
export function CommandToolbar({
  actions,
  label = 'أوامر الصفحة',
  className,
  showModuleNavigator = true,
}: CommandToolbarProps) {
  const { can } = useSession();
  const { locale, dir, t } = useI18n();
  const pathname = usePathname();
  const [moduleNavigatorOpen, setModuleNavigatorOpen] = useState(false);
  const [moduleSearch, setModuleSearch] = useState('');
  const visibleActions = actions.filter((action) => !action.permission || can(action.permission));
  const orderedActions = useMemo(
    () => visibleActions
      .map((action, index) => ({ action, index }))
      .sort((a, b) => commandRank(a.action.id) - commandRank(b.action.id) || a.index - b.index)
      .map(({ action }) => action),
    [visibleActions],
  );
  const mainActions = orderedActions.filter((action) => commandRank(action.id) < 130);
  const trailingActions = orderedActions.filter((action) => commandRank(action.id) >= 130);
  const sections = visibleSections(can);
  const normalizedModuleSearch = moduleSearch.trim().toLocaleLowerCase(locale);
  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!normalizedModuleSearch) return true;
        return `${t(section.title)} ${t(item.label)}`.toLocaleLowerCase(locale).includes(normalizedModuleSearch);
      }),
    }))
    .filter((section) => section.items.length > 0);

  if (orderedActions.length === 0 && !showModuleNavigator) return null;

  const renderAction = (action: CommandToolbarAction, index: number, list: CommandToolbarAction[]) => {
    const Icon = action.icon;
    const previous = list[index - 1];
    const groupBreak = previous && commandGroup(previous.id) !== commandGroup(action.id);
    const commonClassName = cn(
      'group inline-flex h-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg p-0 text-xs font-semibold touch-manipulation transition-[transform,background-color,color,opacity] duration-150 active:scale-[0.97]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-40',
      variants[action.variant ?? 'default'],
      (groupBreak || action.separated) && 'ms-1 border-s border-line ps-2.5',
      action.showLabel && 'h-9 w-auto gap-1.5 px-2.5',
    );
    const content = (
      <>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {action.showLabel ? <span>{action.label}</span> : <span className="sr-only">{action.label}</span>}
      </>
    );

    if (action.href) {
      return (
        <Link
          key={action.id}
          href={action.href}
          aria-label={action.label}
          title={action.label}
          className={commonClassName}
          onClick={action.onClick}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        key={action.id}
        type="button"
        aria-label={action.label}
        title={action.label}
        disabled={action.disabled || action.loading || !action.onClick}
        className={commonClassName}
        onClick={action.onClick}
      >
        {action.loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-e-transparent" aria-hidden="true" />}
        {!action.loading && content}
        {action.loading && <span className="sr-only">جارٍ التنفيذ</span>}
      </button>
    );
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label={label}
        dir={dir}
        className={cn(
          'flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface-raised p-1.5 shadow-card',
          className,
        )}
      >
        {mainActions.map((action, index) => renderAction(action, index, mainActions))}
        {showModuleNavigator && (
          <button
            type="button"
            aria-label={t('common.allModules')}
            title={t('common.allModules')}
            className="group ms-1 inline-flex h-9 min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg border-s border-line ps-2.5 text-ink-muted transition-[transform,background-color,color,opacity] duration-150 active:scale-[0.97] hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            onClick={() => { setModuleNavigatorOpen(true); setModuleSearch(''); }}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t('common.allModules')}</span>
          </button>
        )}
        {trailingActions.map((action, index) => renderAction(action, index, trailingActions))}
      </div>

      <Modal
        open={moduleNavigatorOpen}
        onClose={() => setModuleNavigatorOpen(false)}
        title={t('common.allModules')}
        size="lg"
        closeLabel={t('common.close')}
        footer={<Button type="button" variant="secondary" size="sm" onClick={() => setModuleNavigatorOpen(false)}>{t('common.cancel')}</Button>}
      >
        <label className="relative block">
          <span className="sr-only">{t('common.searchModules')}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            autoFocus
            value={moduleSearch}
            onChange={(event) => setModuleSearch(event.target.value)}
            placeholder={t('common.searchModules')}
            className="ax-input w-full py-2.5 ps-9"
          />
        </label>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {filteredSections.map((section) => (
            <section key={section.title} aria-label={t(section.title)}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-faint">{t(section.title)}</h3>
              <div className="grid gap-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setModuleNavigatorOpen(false)}
                      className={cn(
                        'flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                        active ? 'bg-brand text-white' : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{t(item.label)}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        {filteredSections.length === 0 && <p className="mt-4 rounded-lg bg-surface-muted p-4 text-center text-sm text-ink-muted">{t('common.noModulesFound')}</p>}
      </Modal>
    </>
  );
}
