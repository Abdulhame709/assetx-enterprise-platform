'use client';

import { LogOut, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/session-context';
import { Avatar } from '@/components/ui/Avatar';
import { useMenu } from '@/components/ui/useMenu';
import { useI18n } from '@/lib/i18n';

/** UserMenu — profile menu (roles + logout). */
export function UserMenu() {
  const { session, logout } = useSession();
  const router = useRouter();
  const { t, label } = useI18n();
  const { open, setOpen, close, rootRef, triggerRef, menuRef, onTriggerKeyDown, onMenuKeyDown } = useMenu();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
        title={session?.user.displayName}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={session?.user.displayName ?? t('common.profile')}
      >
        <Avatar name={session?.user.displayName} size="md" />
      </button>
      {open && (
        <div ref={menuRef} role="menu" onKeyDown={onMenuKeyDown} className="animate-modal-in absolute end-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface-overlay shadow-pop">
          <div className="flex items-start gap-3 border-b border-line px-4 py-3">
            <Avatar name={session?.user.displayName} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{session?.user.displayName}</p>
              <p className="truncate text-xs text-ink-muted" dir="ltr"><bdi>@{session?.user.username}</bdi></p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {session?.user.roles.map((r) => (
                  <span key={r} className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-muted">{label(r)}</span>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
            onClick={() => close()}
          >
            <UserIcon className="h-4 w-4" /> {t('common.profile')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger transition-colors hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:outline-none"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" /> {t('common.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
