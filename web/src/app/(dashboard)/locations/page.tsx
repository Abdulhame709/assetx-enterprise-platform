'use client';

/**
 * Locations — hierarchical location management (Master Data).
 * Real workflow: list (GET /locations) → create root/child (POST) → edit (PATCH)
 * → delete (DELETE, guarded by backend when children exist). All via real API.
 */
import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
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

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create-root' }
  | { mode: 'create-child'; parent: LocationNode }
  | { mode: 'edit'; node: LocationNode };

export default function LocationsPage() {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const state = useLocations();
  const toast = useToast();
  const { confirm } = useConfirm();

  const total = state.data?.length ?? 0;
  const roots = state.data?.filter((l) => !l.parent_id).length ?? 0;

  const onDelete = async (node: LocationNode) => {
    const ok = await confirm({
      title: `Delete "${node.name}"`,
      message: 'The location will be deactivated. Locations with child locations cannot be deleted.',
      tone: 'danger',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await deleteLocation(node.id);
      toast.success('Location deleted', `"${node.name}" was deactivated.`);
      state.reload();
    } catch (err) {
      toast.error('Delete failed', humanError(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Locations"
        subtitle={`${total} locations · ${roots} roots`}
        actions={
          <PermissionGate permission={PERMISSIONS.LOCATION_CREATE}>
            <Button variant="primary" size="sm" onClick={() => setModal({ mode: 'create-root' })}>
              <Plus className="h-4 w-4" /> New Root Location
            </Button>
          </PermissionGate>
        }
      />

      <Card className="p-0">
        <div className="border-b border-line p-3">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search locations by name or path…"
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
              modal.mode === 'edit' ? 'Location updated' : 'Location created',
              'Saved to the database.',
            );
            state.reload();
          }}
        />
      )}
    </div>
  );
}
