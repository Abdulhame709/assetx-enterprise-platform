'use client';

import { Building2, Menu } from 'lucide-react';
import { useSession } from '@/lib/auth/session-context';
import { TenantBadge } from './TenantBadge';
import { UserMenu } from './UserMenu';

interface TopbarProps {
  onMenu?: () => void;
}

/** Topbar — top navigation bar: menu toggle, tenant context, user menu. */
export function Topbar({ onMenu }: TopbarProps) {
  const { session } = useSession();

  return (
    <header className="flex h-16 items-center gap-3 border-b border-line bg-surface px-4">
      {onMenu && (
        <button className="rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted lg:hidden" onClick={onMenu} aria-label="Toggle navigation">
          <Menu className="h-5 w-5" />
        </button>
      )}

      <div className="flex items-center gap-2 text-sm font-medium text-ink">
        <Building2 className="h-4 w-4 text-ink-faint" />
        <span>{session?.tenant.name ?? 'Tenant'}</span>
        <TenantBadge code={session?.tenant.code} />
      </div>

      <div className="ms-auto">
        <UserMenu />
      </div>
    </header>
  );
}
