'use client';

/**
 * LocationTree — interactive hierarchy view (expand/collapse, per-row actions).
 * Renders real DB rows; parent/child relations come from parent_id.
 */
import { useMemo, useState } from 'react';
import { Building2, ChevronRight, DoorOpen, Factory, Pencil, Plus, Trash2, TreePine, Warehouse } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/states';
import { LocationNode, LocationType } from '../api';
import { useI18n } from '@/lib/i18n';

const TYPE_ICON: Record<LocationType, typeof Building2> = {
  building: Building2,
  room: DoorOpen,
  warehouse: Warehouse,
  workshop: Factory,
  outdoor: TreePine,
};

interface Row {
  node: LocationNode;
  depth: number;
  hasChildren: boolean;
}

interface LocationTreeProps {
  locations: LocationNode[];
  search: string;
  canCreate: boolean;
  onAddChild: (parent: LocationNode | null) => void;
  onEdit: (node: LocationNode) => void;
  onDelete: (node: LocationNode) => void;
}

export function LocationTree({ locations, search, canCreate, onAddChild, onEdit, onDelete }: LocationTreeProps) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const childrenOf = useMemo(() => {
    const map = new Map<string | null, LocationNode[]>();
    for (const l of locations) {
      const key = l.parent_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [locations]);

  /** Visible rows: full tree flattened, or search matches + ancestors. */
  const rows = useMemo<Row[]>(() => {
    const q = search.trim().toLowerCase();
    const out: Row[] = [];

    if (q) {
      // Keep matches and every ancestor up to the root.
      const byId = new Map(locations.map((l) => [l.id, l]));
      const keep = new Set<string>();
      for (const l of locations) {
        if (l.name.toLowerCase().includes(q) || l.full_path.toLowerCase().includes(q)) {
          let cur: LocationNode | undefined = l;
          while (cur) {
            if (keep.has(cur.id)) break;
            keep.add(cur.id);
            cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
          }
        }
      }
      const walk = (parent: string | null, depth: number) => {
        for (const child of childrenOf.get(parent) ?? []) {
          if (!keep.has(child.id)) continue;
          out.push({ node: child, depth, hasChildren: (childrenOf.get(child.id) ?? []).some((g) => keep.has(g.id)) });
          walk(child.id, depth + 1);
        }
      };
      walk(null, 0);
      return out;
    }

    const walk = (parent: string | null, depth: number) => {
      for (const child of childrenOf.get(parent) ?? []) {
        const kids = childrenOf.get(child.id) ?? [];
        out.push({ node: child, depth, hasChildren: kids.length > 0 });
        if (!collapsed.has(child.id)) walk(child.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [locations, childrenOf, collapsed, search]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <EmptyState
        title={search ? 'No locations match your search' : 'No locations yet'}
        description={
          search
            ? 'Try a different name, or clear the search to see the full tree.'
            : 'Create your first root location (building, warehouse…) to start the hierarchy.'
        }
        actionLabel={!search && canCreate ? 'Create root location' : undefined}
        onAction={!search && canCreate ? () => onAddChild(null) : undefined}
      />
    );
  }

  return (
    <div className="divide-y divide-line">
      {rows.map(({ node, depth, hasChildren }) => {
        const Icon = TYPE_ICON[node.location_type] ?? DoorOpen;
        const isCollapsed = collapsed.has(node.id);
        return (
          <div
            key={node.id}
            className="group flex items-center gap-2 py-2 pe-2 hover:bg-surface-muted/60"
            style={{ paddingInlineStart: `${depth * 22 + 8}px` }}
          >
            <button
              type="button"
              aria-label={isCollapsed ? t('locationTree.expand') : t('locationTree.collapse')}
              title={isCollapsed ? t('locationTree.expand') : t('locationTree.collapse')}
              onClick={() => hasChildren && toggle(node.id)}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md text-ink-faint transition-transform',
                hasChildren ? 'hover:bg-surface-muted hover:text-ink' : 'opacity-0',
                !isCollapsed && 'rotate-90',
              )}
            >
              <ChevronRight className="h-4 w-4 rtl:-scale-x-100" />
            </button>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-ink">{node.name}</span>
                <Badge tone="neutral" className="capitalize">{t(`locationForm.type.${node.location_type}`)}</Badge>
                {!node.is_active && <Badge tone="warning">{t('locationTree.disabled')}</Badge>}
              </div>
              {depth > 0 && <p className="truncate text-xs text-ink-faint">{node.full_path}</p>}
            </div>
            {/* P3 fix UX-10: reveal row actions on keyboard focus and on
                touch devices (hover-only affordance was invisible there). */}
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
              {canCreate && (
                <button
                  type="button"
                  title={t('locationTree.addChild')}
                  aria-label={t('locationTree.addChild')}
                  className="rounded-md p-1.5 text-ink-faint hover:bg-brand/10 hover:text-brand"
                  onClick={() => onAddChild(node)}
                >
                  <Plus className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                title={t('locationTree.edit')}
                aria-label={t('locationTree.edit')}
                className="rounded-md p-1.5 text-ink-faint hover:bg-brand/10 hover:text-brand"
                onClick={() => onEdit(node)}
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                title={t('locationTree.delete')}
                aria-label={t('locationTree.delete')}
                className="rounded-md p-1.5 text-ink-faint hover:bg-danger/10 hover:text-danger"
                onClick={() => onDelete(node)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
