'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Pencil, Plus, RefreshCw, Search, Undo2 } from 'lucide-react';
import { useAsync } from '@/lib/use-async';
import { useI18n } from '@/lib/i18n';
import { getCategories, CategoryOption } from '@/features/assets/api';
import { createModel, getModels, ReferenceModel, updateModel } from '@/features/reference/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommandToolbar } from '@/components/ui/CommandToolbar';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/form';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { humanError } from '@/lib/api/errors';
import { useToast } from '@/components/ui/Toast';

export default function ModelsPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const state = useAsync<ReferenceModel[]>(getModels, [], { isEmpty: (items) => items.length === 0 });
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<ReferenceModel | null | undefined>(undefined);

  useEffect(() => {
    getCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const categoryLabels = useMemo(() => new Map(categories.map((category) => [category.value, category.label])), [categories]);
  const models = state.data ?? [];
  const filteredModels = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(locale);
    if (!term) return models;
    return models.filter((model) => [model.name, categoryLabels.get(model.category_id ?? '') ?? '']
      .some((value) => value.toLocaleLowerCase(locale).includes(term)));
  }, [categoryLabels, locale, models, search]);
  const categorizedCount = models.filter((model) => model.category_id).length;

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.models')} subtitle={t('models.subtitle')} />
      <CommandToolbar
        label={t('models.commandToolbar')}
        actions={[
          { id: 'search', label: t('models.searchCommand'), icon: Search, onClick: () => searchInputRef.current?.focus(), variant: 'primary' },
          { id: 'refresh', label: t('common.refresh'), icon: RefreshCw, onClick: state.reload, loading: state.status === 'loading' },
          { id: 'add', label: t('models.new'), icon: Plus, onClick: () => setEditing(null), permission: PERMISSIONS.MODEL_CREATE, variant: 'primary', separated: true },
          { id: 'reset', label: t('models.clearSearch'), icon: Undo2, onClick: () => setSearch(''), disabled: !search },
        ]}
      />

      <section aria-label={t('models.metrics')} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard icon={Box} label={t('models.total')} value={models.length.toLocaleString(locale)} />
        <MetricCard icon={Box} label={t('models.categorized')} value={categorizedCount.toLocaleString(locale)} />
        <MetricCard icon={Search} label={t('models.visible')} value={filteredModels.length.toLocaleString(locale)} />
      </section>

      <Card className="overflow-hidden p-0 shadow-card">
        <CardBody className="p-0">
          <div className="border-b border-line p-3">
            <label className="relative block max-w-xl">
              <span className="sr-only">{t('models.search')}</span>
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('models.search')} className="ax-input w-full py-2 ps-9" />
            </label>
          </div>
          {state.status === 'loading' && <LoadingState rows={5} />}
          {state.status === 'error' && <ErrorState message={humanError(state.error, t('common.genericError'), locale)} onRetry={state.reload} />}
          {state.status === 'success' && filteredModels.length === 0 && (
            <EmptyState
              title={search ? t('models.noMatch') : t('models.none')}
              description={search ? t('models.noMatchDesc') : t('models.noneDesc')}
              actionLabel={!search ? t('models.create') : undefined}
              onAction={!search ? () => setEditing(null) : undefined}
            />
          )}
          {state.status === 'success' && filteredModels.length > 0 && (
            <div className="divide-y divide-line">
              {filteredModels.map((model) => (
                <div key={model.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/60">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Box className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{model.name}</p>
                    <p className="truncate text-xs text-ink-muted">{model.category_id ? categoryLabels.get(model.category_id) ?? t('models.unknownCategory') : t('models.unclassified')}</p>
                  </div>
                  <PermissionGate permission={PERMISSIONS.MODEL_UPDATE}>
                    <Button variant="secondary" size="sm" className="h-8 w-8 shrink-0 p-0" aria-label={t('models.edit')} title={t('models.edit')} onClick={() => setEditing(model)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </PermissionGate>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {editing !== undefined && (
        <ModelFormModal
          key={editing?.id ?? 'new'}
          model={editing}
          categories={categories}
          onClose={() => setEditing(undefined)}
          onSaved={(mode) => {
            toast.success(mode === 'create' ? t('models.created') : t('models.updated'), t('models.saved'));
            setEditing(undefined);
            state.reload();
          }}
        />
      )}
    </div>
  );
}

function ModelFormModal({ model, categories, onClose, onSaved }: { model: ReferenceModel | null; categories: CategoryOption[]; onClose: () => void; onSaved: (mode: 'create' | 'edit') => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(model?.name ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(model?.category_id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mode = model ? 'edit' : 'create';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedName = name.trim();
    setError(null);
    if (normalizedName.length < 2) { setError(t('models.nameTooShort')); return; }
    setSaving(true);
    try {
      const input = { name: normalizedName, ...(categoryId ? { category_id: categoryId } : {}) };
      if (model) await updateModel(model.id, input);
      else await createModel(input);
      onSaved(mode);
    } catch (err) {
      setError(humanError(err, t('common.genericError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={model ? t('models.editTitle').replace('{name}', model.name) : t('models.createTitle')} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('models.name')} hint={t('models.nameHint')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} autoFocus required minLength={2} />
        </Field>
        <Field label={t('models.category')} hint={t('models.categoryHint')}>
          <SearchableSelect options={categories} value={categoryId} onChange={setCategoryId} placeholder={t('models.chooseCategory')} clearable />
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" size="sm" loading={saving}>{model ? t('models.save') : t('models.create')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Box; label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4"><div className="flex items-start justify-between gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand"><Icon className="h-4 w-4" /></span><span className="text-2xl font-semibold tabular-nums text-ink">{value}</span></div><p className="mt-3 text-xs font-medium text-ink-muted">{label}</p></div>;
}
