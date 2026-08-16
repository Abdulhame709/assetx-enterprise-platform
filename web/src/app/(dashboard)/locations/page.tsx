'use client';

/**
 * Locations — hierarchical location management (Master Data).
 * Real workflow: list (GET /locations) → create root/child (POST) → edit (PATCH)
 * → delete (DELETE, guarded by backend when children exist). All via real API.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { FileSpreadsheet, Plus, RefreshCw, Search, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommandToolbar } from '@/components/ui/CommandToolbar';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState, ErrorState } from '@/components/ui/states';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { humanError } from '@/lib/api/errors';
import { useLocations, deleteLocation, LocationNode } from '@/features/locations/use-locations';
import { LocationTree } from '@/features/locations/components/LocationTree';
import { LocationFormModal } from '@/features/locations/components/LocationFormModal';
import { useI18n } from '@/lib/i18n';

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create-root' }
  | { mode: 'create-child'; parent: LocationNode }
  | { mode: 'edit'; node: LocationNode };

export default function LocationsPage() {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const state = useLocations();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { t, locale } = useI18n();

  const total = state.data?.length ?? 0;
  const roots = state.data?.filter((l) => !l.parent_id).length ?? 0;

  const onDelete = async (node: LocationNode) => {
    const ok = await confirm({
      title: t('locationPage.deleteTitle').replace('{name}', node.name),
      message: t('locationPage.deleteMessage'),
      tone: 'danger',
      confirmLabel: t('locationPage.delete'),
    });
    if (!ok) return;
    try {
      await deleteLocation(node.id);
      toast.success(t('locationPage.deleted'), t('locationPage.deletedMessage').replace('{name}', node.name));
      state.reload();
    } catch (err) {
      toast.error(t('locationPage.deleteFailed'), humanError(err));
    }
  };

  return (
    <div>
      <PageHeader
        title={t('locationPage.title')}
        subtitle={t('locationPage.summary').replace('{total}', total.toLocaleString(locale)).replace('{roots}', roots.toLocaleString(locale))}
        actions={<div className="flex flex-wrap gap-2"><PermissionGate permission={PERMISSIONS.LOCATION_CREATE}><Link href="/import-data?resource=locations" className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-line bg-surface-raised px-3 text-xs font-medium text-ink transition-colors hover:bg-surface-muted"><FileSpreadsheet className="h-4 w-4" /> {t('assets.importExcel')}</Link></PermissionGate><PermissionGate permission={PERMISSIONS.LOCATION_CREATE}><Button variant="primary" size="sm" onClick={() => setModal({ mode: 'create-root' })}><Plus className="h-4 w-4" /> {t('locationPage.newRoot')}</Button></PermissionGate></div>}
      />

      <CommandToolbar
        label={t('locationPage.commandToolbar')}
        actions={[
          { id: 'search', label: t('locationPage.searchCommand'), icon: Search, onClick: () => searchInputRef.current?.focus(), variant: 'primary' },
          { id: 'refresh', label: t('common.refresh'), icon: RefreshCw, onClick: state.reload, loading: state.status === 'loading' },
          { id: 'import', label: t('assets.importExcel'), icon: FileSpreadsheet, href: '/import-data?resource=locations', permission: PERMISSIONS.LOCATION_CREATE, separated: true },
          { id: 'add', label: t('locationPage.newRoot'), icon: Plus, onClick: () => setModal({ mode: 'create-root' }), permission: PERMISSIONS.LOCATION_CREATE, variant: 'primary' },
          { id: 'reset', label: t('locationPage.resetSearch'), icon: Undo2, onClick: () => setSearch(''), disabled: !search },
        ]}
      />

      <Card className="p-0">
        <div className="border-b border-line p-3">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('locationPage.search')}
              className="ax-input ps-9"
            />
          </div>
        </div>
        <CardBody className="p-0">
          {state.status === 'loading' && <LoadingState rows={6} />}
          {state.status === 'error' && (
            <ErrorState message={humanError(state.error)} onRetry={state.reload} />
          )}
          {state.status === 'success' && state.data && (
            <LocationTree
              locations={state.data}
              search={search}
              canCreate={true}
              onAddChild={(parent) =>
                setModal(parent ? { mode: 'create-child', parent } : { mode: 'create-root' })
              }
              onEdit={(node) => setModal({ mode: 'edit', node })}
              onDelete={(node) => void onDelete(node)}
            />
          )}
        </CardBody>
      </Card>

      {modal.mode !== 'closed' && (
        <LocationFormModal
          open
          mode={modal.mode}
          parent={modal.mode === 'create-child' ? modal.parent : null}
          node={modal.mode === 'edit' ? modal.node : null}
          onClose={() => setModal({ mode: 'closed' })}
          onSaved={() => {
            toast.success(
              modal.mode === 'edit' ? t('locationPage.updated') : t('locationPage.created'),
              t('locationPage.saved'),
            );
            state.reload();
          }}
        />
      )}
    </div>
  );
}
