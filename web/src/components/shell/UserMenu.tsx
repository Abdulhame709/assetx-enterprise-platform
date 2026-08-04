'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/session-context';
import { cn } from '@/lib/cn';

/** UserMenu — profile menu (roles + logout). */
export function UserMenu() {
  const { session, logout } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const initials = (session?.user.displayName ?? 'U').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-surface-muted"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white">
          {initials}
        </span>
      </button>
      {open && (
        <div role="menu" className="absolute end-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface-overlay shadow-pop">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-medium text-ink">{session?.user.displayName}</p>
            <p className="text-xs text-ink-muted">@{session?.user.username}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {session?.user.roles.map((r) => (
                <span key={r} className="rounded bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-muted">{r}</span>
              ))}
            </div>
          </div>
          <button
            role="menuitem"
            className={cn('flex w-full items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-surface-muted')}
            onClick={() => setOpen(false)}
          >
            <UserIcon className="h-4 w-4" /> Profile
          </button>
          <button
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-surface-muted"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
