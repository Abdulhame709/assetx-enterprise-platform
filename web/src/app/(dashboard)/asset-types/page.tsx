'use client';

/**
 * Asset Types — hierarchical classification management (backend: /categories).
 * Create root/child + rename only — the backend exposes no delete for categories,
 * so no delete action is offered (contract parity, no fake buttons).
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Pencil, Plus, Search, Tag } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/form';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useToast } from '@/components/ui/Toast';
import { humanError } from '@/lib/api/errors';
import { cn } from '@/lib/cn';
import { useAssetTypes, createAssetType, updateAssetType, AssetTypeNode } from '@/features/asset-types/use-asset-types';

type ModalState =
  | { mode: 'closed' }
  | { mode: 'create'; parent: AssetTypeNode | null }
  | { mode: 'edit'; node: AssetTypeNode };

export default function AssetTypesPage() {
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const state = useAssetTypes();
  const toast = useToast();

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, AssetTypeNode[]>();
    for (const t of state.data ?? []) {
      const key = t.parent_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [state.data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out: { node: AssetTypeNode; depth: number }[] = [];
    const all = state.data ?? [];
    if (q) {
      const byId = new Map(all.map((t) => [t.id, t]));
      const keep = new Set<string>();
      for (const t of all) {
        if (t.name.toLowerCase().includes(q) || t.full_path.toLowerCase().includes(q)) {
          let cur: AssetTypeNode | undefined = t;
          while (cur) { if (keep.has(cur.id)) break; keep.add(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined; }
        }
      }
      const walk = (parent: string | null, depth: number) => {
        for (const child of childrenOf.get(parent) ?? []) {
          if (!keep.has(child.id)) continue;
          out.push({ node: child, depth });
          walk(child.id, depth + 1);
        }
      };
      walk(null, 0);
      return out;
    }
    const walk = (parent: string | null, depth: number) => {
      for (const child of childrenOf.get(parent) ?? []) {
        out.push({ node: child, depth });
        walk(child.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [state.data, childrenOf, search]);

  const roots = state.data?.filter((t) => !t.parent_id).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Asset Types"
        subtitle={`${state.data?.length ?? 0} types · ${roots} roots`}
        actions={
          <PermissionGate permission={PERMISSIONS.CATEGORY_CREATE}>
            <Button variant="primary" size="sm" onClick={() => setModal({ mode: 'create', parent: null })}>
              <Plus className="h-4 w-4" /> New Type
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
              placeholder="Search asset types…"
              className="ax-input ps-9"
            />
          </div>
        </div>
        <CardBody className="p-0">
          {state.status === 'loading' && <LoadingState rows={5} />}
          {state.status === 'error' && <ErrorState message={humanError(state.error)} onRetry={state.reload} />}
          {state.status === 'success' && rows.length === 0 && (
            <EmptyState
              title={search ? 'No asset types match your search' : 'No asset types yet'}
              description={
                search
                  ? 'Try a different name, or clear the search.'
                  : 'Create your first type (e.g. IT, Furniture, Vehicles) to classify assets.'
              }
              actionLabel={!search ? 'Create type' : undefined}
              onAction={!search ? () => setModal({ mode: 'create', parent: null }) : undefined}
            />
          )}
          {state.status === 'success' && rows.length > 0 && (
            <div className="divide-y divide-line">
              {rows.map(({ node, depth }) => (
                <div
                  key={node.id}
                  className={cn('group flex items-center gap-2 py-2 pe-2 hover:bg-surface-muted/60')}
                  style={{ paddingInlineStart: `${depth * 22 + 8}px` }}
                >
                  <ChevronRight className={cn('h-4 w-4 rotate-90 text-ink-faint', !(childrenOf.get(node.id)?.length) && 'opacity-0')} />
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
                    <Tag className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-sm font-medium text-ink">{node.name}</span>
                    {depth > 0 && <p className="truncate text-xs text-ink-faint">{node.full_path}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <PermissionGate permission={PERMISSIONS.CATEGORY_CREATE}>
                      <button
                        type="button"
                        title="Add sub-type"
                        className="rounded-md p-1.5 text-ink-faint hover:bg-brand/10 hover:text-brand"
                        onClick={() => setModal({ mode: 'create', parent: node })}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </PermissionGate>
                    <PermissionGate permission={PERMISSIONS.CATEGORY_UPDATE}>
                      <button
                        type="button"
                        title="Rename type"
                        className="rounded-md p-1.5 text-ink-faint hover:bg-brand/10 hover:text-brand"
                        onClick={() => setModal({ mode: 'edit', node })}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </PermissionGate>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {modal.mode !== 'closed' && (
        <AssetTypeModal
          mode={modal.mode}
          parent={modal.mode === 'create' ? modal.parent : null}
          node={modal.mode === 'edit' ? modal.node : null}
          onClose={() => setModal({ mode: 'closed' })}
          onSaved={(verb) => {
            toast.success(verb === 'edit' ? 'Type updated' : 'Type created', 'Saved to the database.');
            state.reload();
            setModal({ mode: 'closed' });
          }}
        />
      )}
    </div>
  );
}

function AssetTypeModal({
  mode, parent, node, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  parent: AssetTypeNode | null;
  node: AssetTypeNode | null;
  onClose: () => void;
  onSaved: (verb: 'create' | 'edit') => void;
}) {
  const [name, setName] = useState(mode === 'edit' ? node?.name ?? '' : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(mode === 'edit' ? node?.name ?? '' : ''); setError(null); }, [mode, node]);

  const title = mode === 'edit' ? `Rename ${node?.name ?? 'type'}` : parent ? `Add sub-type under ${parent.name}` : 'Create asset type';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) { setError('Name must be at least 2 characters.'); return; }
    setSaving(true);
    try {
      if (mode === 'edit' && node) await updateAssetType(node.id, { name: name.trim() });
      else await createAssetType({ name: name.trim(), parent_id: parent?.id ?? null });
      onSaved(mode);
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" hint="Must be unique across asset types.">
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus required minLength={2} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            {mode === 'edit' ? 'Save changes' : 'Create type'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
