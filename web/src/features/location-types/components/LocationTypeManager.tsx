'use client';

import { FormEvent, useState } from 'react';
import { Check, Edit3, Power, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/form';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { humanError } from '@/lib/api/errors';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useCan } from '@/lib/auth/session-context';
import { useI18n } from '@/lib/i18n';
import { getLocationTypeIcon, LOCATION_TYPE_ICON_OPTIONS } from '../icon-options';
import { createLocationType, updateLocationType, deactivateLocationType, LocationTypeOption } from '../api';
import { useLocationTypes } from '../use-location-types';

interface Draft {
  code: string;
  name_ar: string;
  name_en: string;
  icon_key: string;
  sort_order: string;
}

const EMPTY_DRAFT: Draft = { code: '', name_ar: '', name_en: '', icon_key: 'map-pin', sort_order: '100' };

export function LocationTypeManager() {
  const { t, locale } = useI18n();
  const { confirm } = useConfirm();
  const toast = useToast();
  const can = useCan();
  const state = useLocationTypes();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LocationTypeOption | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canView = can(PERMISSIONS.LOCATION_TYPE_VIEW);
  const canCreate = can(PERMISSIONS.LOCATION_TYPE_CREATE);
  const canUpdate = can(PERMISSIONS.LOCATION_TYPE_UPDATE);
  const canDelete = can(PERMISSIONS.LOCATION_TYPE_DELETE);

  const openCreate = () => {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (item: LocationTypeOption) => {
    setEditing(item);
    setDraft({
      code: item.code,
      name_ar: item.name_ar,
      name_en: item.name_en ?? '',
      icon_key: item.icon_key,
      sort_order: String(item.sort_order),
    });
    setError(null);
    setModalOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const sortOrder = Number(draft.sort_order || 0);
      if (editing) {
        await updateLocationType(editing.id, {
          name_ar: draft.name_ar.trim(),
          name_en: draft.name_en.trim() || null,
          icon_key: draft.icon_key,
          sort_order: sortOrder,
        });
        toast.success(t('settings.locationTypesUpdated'), draft.name_ar.trim());
      } else {
        await createLocationType({
          code: draft.code.trim().toLowerCase(),
          name_ar: draft.name_ar.trim(),
          name_en: draft.name_en.trim() || undefined,
          icon_key: draft.icon_key,
          sort_order: sortOrder,
        });
        toast.success(t('settings.locationTypesCreated'), draft.name_ar.trim());
      }
      setModalOpen(false);
      state.reload();
    } catch (err) {
      setError(humanError(err, t('common.genericError'), locale));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: LocationTypeOption) => {
    const next = !item.is_active;
    const approved = await confirm({
      title: next ? t('settings.locationTypeActivateTitle') : t('settings.locationTypeDeactivateTitle'),
      message: next ? t('settings.locationTypeActivateMessage') : t('settings.locationTypeDeactivateMessage'),
      confirmLabel: next ? t('settings.activate') : t('settings.deactivate'),
      tone: next ? 'default' : 'danger',
    });
    if (!approved) return;
    try {
      if (next) {
        await updateLocationType(item.id, { is_active: true });
      } else {
        await deactivateLocationType(item.id);
      }
      toast.success(next ? t('settings.locationTypeActivated') : t('settings.locationTypeDeactivated'), item.name_ar);
      state.reload();
    } catch (err) {
      toast.error(t('settings.locationTypeActionFailed'), humanError(err, t('common.genericError'), locale));
    }
  };

  if (!canView) return <EmptyState title={t('settings.noLocationTypeAccess')} description={t('settings.noLocationTypeAccessDesc')} />;
  if (state.status === 'loading') return <LoadingState rows={5} />;
  if (state.status === 'error') return <ErrorState message={humanError(state.error, t('common.genericError'), locale)} onRetry={state.reload} />;

  const items = state.data ?? [];
  return (
    <Card>
      <CardHeader
        title={t('settings.locationTypesTitle')}
        subtitle={t('settings.locationTypesDesc')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={state.reload} title={t('common.refresh')} aria-label={t('common.refresh')}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
            {canCreate && <Button variant="primary" size="sm" onClick={openCreate}><Plus className="h-4 w-4" aria-hidden="true" />{t('settings.newLocationType')}</Button>}
          </div>
        }
      />
      {items.length === 0 ? <EmptyState title={t('settings.noLocationTypes')} description={t('settings.noLocationTypesDesc')} actionLabel={canCreate ? t('settings.newLocationType') : undefined} onAction={canCreate ? openCreate : undefined} /> : (
        <CardBody className="space-y-2">
          {items.map((item) => {
            const Icon = getLocationTypeIcon(item.icon_key);
            const label = locale === 'ar' ? item.name_ar : item.name_en ?? item.name_ar;
            return (
              <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface-muted/30 p-3 sm:flex-row sm:items-center">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{label}</span>
                    <Badge tone={item.is_active ? 'success' : 'warning'}>{item.is_active ? t('common.active') : t('common.inactive')}</Badge>
                    {item.is_system && <Badge tone="neutral">{t('settings.systemType')}</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted"><code>{item.code}</code> · {t('settings.sortOrder')}: {item.sort_order.toLocaleString(locale)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {canUpdate && <Button variant="ghost" size="sm" onClick={() => openEdit(item)} title={t('common.edit')} aria-label={t('common.edit')}><Edit3 className="h-4 w-4" aria-hidden="true" /></Button>}
                  {canDelete && <Button variant={item.is_active ? 'ghost' : 'secondary'} size="sm" onClick={() => void toggleActive(item)} title={item.is_active ? t('settings.deactivate') : t('settings.activate')} aria-label={item.is_active ? t('settings.deactivate') : t('settings.activate')}><Power className="h-4 w-4" aria-hidden="true" /></Button>}
                </div>
              </div>
            );
          })}
        </CardBody>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t('settings.editLocationType') : t('settings.newLocationType')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" form="location-type-form" type="submit" loading={saving}><Check className="h-4 w-4" aria-hidden="true" />{t('common.save')}</Button>
          </>
        }
      >
        <form id="location-type-form" onSubmit={(event) => void submit(event)} className="space-y-4">
          <Field label={t('settings.locationTypeCode')} hint={editing ? t('settings.locationTypeCodeLocked') : t('settings.locationTypeCodeHint')}>
            <Input value={draft.code} onChange={(event) => setDraft((current) => ({ ...current, code: event.target.value }))} disabled={Boolean(editing)} required minLength={2} />
          </Field>
          <Field label={t('settings.locationTypeNameArabic')}>
            <Input value={draft.name_ar} onChange={(event) => setDraft((current) => ({ ...current, name_ar: event.target.value }))} required minLength={2} />
          </Field>
          <Field label={t('settings.locationTypeNameEnglish')}>
            <Input value={draft.name_en} onChange={(event) => setDraft((current) => ({ ...current, name_en: event.target.value }))} />
          </Field>
          <Field label={t('settings.locationTypeIcon')}>
            <Select value={draft.icon_key} onChange={(event) => setDraft((current) => ({ ...current, icon_key: event.target.value }))}>
              {LOCATION_TYPE_ICON_OPTIONS.map(({ key }) => <option key={key} value={key}>{key}</option>)}
            </Select>
          </Field>
          <Field label={t('settings.sortOrder')}>
            <Input type="number" min={0} max={9999} value={draft.sort_order} onChange={(event) => setDraft((current) => ({ ...current, sort_order: event.target.value }))} />
          </Field>
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        </form>
      </Modal>
    </Card>
  );
}
