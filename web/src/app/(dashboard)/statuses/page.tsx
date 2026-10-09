'use client';

/** Asset statuses — governed master data with StatusColor support (README §13.9). */
import { FormEvent, useMemo, useRef, useState } from 'react';
import { CircleDot, FileSpreadsheet, Pencil, Plus, Printer, RefreshCw, Search, Trash2, Undo2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommandToolbar } from '@/components/ui/CommandToolbar';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/form';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useAsync } from '@/lib/use-async';
import { humanError } from '@/lib/api/errors';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/lib/i18n';
import { createStatus, deleteStatus, getStatuses, ReferenceStatus, updateStatus } from '@/features/reference/api';

type ModalState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; status: ReferenceStatus };

export default function StatusesPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { confirm } = useConfirm();
  const state = useAsync(() => getStatuses(), [], { isEmpty: (items) => items.length === 0 });
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const statuses = useMemo(() => {
    const term = search.trim().toLocaleLowerCase(locale);
    return (state.data ?? []).filter((status) => !term || status.name.toLocaleLowerCase(locale).includes(term));
  }, [locale, search, state.data]);

  const deactivate = async (status: ReferenceStatus) => {
    const accepted = await confirm({
      title: t('statuses.deactivateTitle').replace('{name}', status.name),
      message: t('statuses.deactivateMessage'),
      tone: 'danger',
      confirmLabel: t('statuses.deactivate'),
    });
    if (!accepted) return;
    setDeactivatingId(status.id);
    try {
      await deleteStatus(status.id);
      toast.success(t('statuses.deactivated'), t('statuses.saved'));
      state.reload();
    } catch (err) {
      toast.error(t('common.error'), humanError(err));
    } finally {
      setDeactivatingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('statuses.title')}
        subtitle={t('statuses.summary').replace('{count}', (state.data?.length ?? 0).toLocaleString(locale))}
      />
      <CommandToolbar
        label={t('statuses.commandToolbar')}
        actions={[
          { id: 'search', label: t('statuses.searchCommand'), icon: Search, onClick: () => searchInputRef.current?.focus(), variant: 'primary' },
          { id: 'refresh', label: t('common.refresh'), icon: RefreshCw, onClick: state.reload, loading: state.status === 'loading' },
          { id: 'print', label: t('common.print'), icon: Printer, onClick: () => window.print(), separated: true },
          { id: 'import', label: t('assets.importExcel'), icon: FileSpreadsheet, href: '/import-data?resource=statuses', permission: PERMISSIONS.STATUS_CREATE, separated: true },
          { id: 'add', label: t('statuses.new'), icon: Plus, onClick: () => setModal({ mode: 'create' }), permission: PERMISSIONS.STATUS_CREATE, variant: 'primary' },
          { id: 'reset', label: t('statuses.resetSearch'), icon: Undo2, onClick: () => setSearch(''), disabled: !search },
        ]}
      />
      <Card className="p-0">
        <div className="border-b border-line p-3">
          <div className="relative max-w-sm">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('statuses.search')} className="ax-input ps-9" />
          </div>
        </div>
        <CardBody className="p-0">
          {state.status === 'loading' && <LoadingState rows={5} />}
          {state.status === 'error' && <ErrorState message={humanError(state.error)} onRetry={state.reload} />}
          {state.status === 'success' && statuses.length === 0 && (
            <EmptyState
              title={search ? t('statuses.noMatch') : t('statuses.none')}
              description={search ? t('statuses.noMatchDesc') : t('statuses.noneDesc')}
              actionLabel={!search ? t('statuses.create') : undefined}
              onAction={!search ? () => setModal({ mode: 'create' }) : undefined}
            />
          )}
          {state.status === 'success' && statuses.length > 0 && (
            <div className="divide-y divide-line">
              {statuses.map((status) => (
                <div key={status.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-muted/60">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${status.color ?? '#64748b'}22`, color: status.color ?? '#64748b' }}>
                    <CircleDot className="h-5 w-5" />
                  </span>
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-surface" style={{ backgroundColor: status.color ?? '#64748b' }} aria-label={status.color ?? t('statuses.noColor')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{status.name}</p>
                    <p className="font-mono text-xs text-ink-faint">{status.color ?? t('statuses.noColor')}</p>
                  </div>
                  {!status.is_active && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">{t('statuses.inactive')}</span>}
                  <PermissionGate permission={PERMISSIONS.STATUS_UPDATE}>
                    <button type="button" className="rounded-md p-1.5 text-ink-faint opacity-100 transition-opacity hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:opacity-0 sm:group-hover:opacity-100" title={t('statuses.edit')} aria-label={t('statuses.edit')} onClick={() => setModal({ mode: 'edit', status })}>
                      <Pencil className="h-4 w-4" />
                    </button>
                  </PermissionGate>
                  <PermissionGate permission={PERMISSIONS.STATUS_DELETE}>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-ink-faint opacity-100 transition-opacity hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100"
                      title={t('statuses.deactivate')}
                      aria-label={t('statuses.deactivate')}
                      disabled={deactivatingId === status.id}
                      onClick={() => deactivate(status)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </PermissionGate>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      {modal.mode !== 'closed' && (
        <StatusModal
          key={modal.mode === 'edit' ? modal.status.id : 'create'}
          mode={modal.mode}
          status={modal.mode === 'edit' ? modal.status : null}
          onClose={() => setModal({ mode: 'closed' })}
          onSaved={(mode) => {
            toast.success(mode === 'create' ? t('statuses.created') : t('statuses.updated'), t('statuses.saved'));
            setModal({ mode: 'closed' });
            state.reload();
          }}
        />
      )}
    </div>
  );
}

function StatusModal({ mode, status, onClose, onSaved }: { mode: 'create' | 'edit'; status: ReferenceStatus | null; onClose: () => void; onSaved: (mode: 'create' | 'edit') => void }) {
  const { t } = useI18n();
  const [name, setName] = useState(status?.name ?? '');
  const [color, setColor] = useState(status?.color ?? '#2563eb');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedColor = color.trim();
    setError(null);
    if (normalizedName.length < 2) { setError(t('statuses.nameTooShort')); return; }
    if (!/^#[0-9a-fA-F]{6}$/.test(normalizedColor)) { setError(t('statuses.colorInvalid')); return; }
    setSaving(true);
    try {
      if (mode === 'edit' && status) await updateStatus(status.id, { name: normalizedName, color: normalizedColor });
      else await createStatus({ name: normalizedName, color: normalizedColor });
      onSaved(mode);
    } catch (err) { setError(humanError(err)); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={mode === 'edit' ? t('statuses.editTitle').replace('{name}', status?.name ?? '') : t('statuses.createTitle')} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('statuses.name')}><Input value={name} onChange={(event) => setName(event.target.value)} minLength={2} autoFocus required /></Field>
        <Field label={t('statuses.color')} hint={t('statuses.colorHint')}>
          <div className="flex items-center gap-2"><input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#2563eb'} onChange={(event) => setColor(event.target.value)} className="h-10 w-12 cursor-pointer rounded border border-line bg-surface p-1" /><Input value={color} onChange={(event) => setColor(event.target.value)} dir="ltr" placeholder="#2563eb" /></div>
        </Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" size="sm" loading={saving}>{mode === 'create' ? t('statuses.create') : t('statuses.save')}</Button></div>
      </form>
    </Modal>
  );
}
