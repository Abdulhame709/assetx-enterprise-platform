'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Filter, FilterX, ListFilter, Printer, RefreshCw, Save, Search, Trash2, Undo2 } from 'lucide-react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommandToolbar } from '@/components/ui/CommandToolbar';
import { Field, Input, Select } from '@/components/ui/form';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { getCategories } from '@/features/assets/api';
import { getLocationsTree } from '@/features/assets/components/reference-selects';
import { getEmployees, getStatuses, type ReferenceEmployee, type ReferenceStatus } from '@/features/reference/api';
import {
  createSavedSearch,
  deleteSavedSearch,
  executeSavedSearch,
  getSavedSearches,
  type AuditSearchItem,
  type MovementSearchItem,
  type SavedSearchRecord,
  type SearchItem,
  type SearchResource,
} from '@/features/search/api';
import { useAdvancedSearch, useStableSearchQuery } from '@/features/search/use-search';
import { humanError } from '@/lib/api/errors';
import { useCan } from '@/lib/auth/session-context';
import { PERMISSIONS, type PermissionKey } from '@/lib/auth/permissions';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { shortRef } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

const SEARCH_RESOURCES: Array<{ value: SearchResource; permission: PermissionKey; labelKey: string }> = [
  { value: 'assets', permission: PERMISSIONS.ASSET_VIEW, labelKey: 'module.searchResourceAssets' },
  { value: 'movements', permission: PERMISSIONS.MOVEMENT_VIEW, labelKey: 'module.searchResourceMovements' },
  { value: 'audit', permission: PERMISSIONS.AUDIT_VIEW, labelKey: 'module.searchResourceAudit' },
];

const SORT_OPTIONS: Record<SearchResource, Array<{ value: string; labelKey: string }>> = {
  assets: [
    { value: 'name', labelKey: 'module.searchSortName' },
    { value: 'full_asset_code', labelKey: 'module.searchSortCode' },
    { value: 'purchase_date', labelKey: 'module.searchSortPurchaseDate' },
    { value: 'purchase_price', labelKey: 'module.searchSortPurchasePrice' },
    { value: 'created_at', labelKey: 'module.searchSortCreatedAt' },
    { value: 'quantity', labelKey: 'module.searchSortQuantity' },
  ],
  movements: [
    { value: 'created_at', labelKey: 'module.searchSortCreatedAt' },
    { value: 'movement_type', labelKey: 'module.searchSortMovementType' },
    { value: 'status', labelKey: 'module.searchSortStatus' },
  ],
  audit: [
    { value: 'created_at', labelKey: 'module.searchSortCreatedAt' },
    { value: 'action_type', labelKey: 'module.searchSortAction' },
    { value: 'table_name', labelKey: 'module.searchSortEntity' },
  ],
};

function defaultSort(resource: SearchResource): string {
  return resource === 'assets' ? 'name' : 'created_at';
}

function defaultDirection(resource: SearchResource): 'asc' | 'desc' {
  return resource === 'assets' ? 'asc' : 'desc';
}

function asString(value: unknown): string {
  return value == null ? '' : String(value);
}

function renderAssetResult(item: SearchItem, t: (key: string, fallback?: string) => string) {
  if (!('name' in item)) return null;
  return (
    <Link key={item.id} href={`/assets/${item.id}`} className="block rounded-lg px-2 py-3 transition-colors hover:bg-surface-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="font-medium text-brand">{item.name}</p>
        <p className="text-xs text-ink-muted">{item._statusName ?? '—'} · {item._employeeName ?? t('module.searchUnassigned')}</p>
      </div>
      <p className="text-xs text-ink-muted">{t('module.searchCode')}: {item.full_asset_code} · {t('module.searchLocation')}: {item._locationName ?? '—'}</p>
    </Link>
  );
}

function renderMovementResult(item: SearchItem, t: (key: string, fallback?: string) => string) {
  if (!('movement_type' in item)) return null;
  const movement = item as MovementSearchItem;
  return (
    <Link key={movement.id} href="/movements" className="block rounded-lg px-2 py-3 transition-colors hover:bg-surface-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="font-medium text-brand">{t(`movementType.${movement.movement_type}`, movement.movement_type)}</p>
        <p className="text-xs text-ink-muted">{t(`movementStatus.${movement.status}`, movement.status)} · {movement.created_at ? new Date(movement.created_at).toLocaleString() : '—'}</p>
      </div>
      <p className="text-xs text-ink-muted">{t('module.searchReference')}: {movement.reference_number ?? shortRef(movement.id)} · {t('module.searchReason')}: {movement.reason ?? '—'}</p>
    </Link>
  );
}

function renderAuditResult(item: SearchItem, t: (key: string, fallback?: string) => string) {
  if (!('action_type' in item)) return null;
  const audit = item as AuditSearchItem;
  return (
    <Link key={audit.id} href="/audit" className="block rounded-lg px-2 py-3 transition-colors hover:bg-surface-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="font-medium text-brand">{t(`auditAction.${audit.action_type}`, audit.action_type)}</p>
        <p className="text-xs text-ink-muted">{audit.created_at ? new Date(audit.created_at).toLocaleString() : '—'}</p>
      </div>
      <p className="text-xs text-ink-muted">{t('module.searchEntity')}: {audit.entity || '—'} · {t('module.searchRecord')}: {audit.entity_id ? shortRef(audit.entity_id) : '—'}</p>
    </Link>
  );
}

export default function SearchPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { confirm } = useConfirm();
  const can = useCan();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [resource, setResource] = useState<SearchResource>('assets');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [purchaseDateFrom, setPurchaseDateFrom] = useState('');
  const [purchaseDateTo, setPurchaseDateTo] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [isActive, setIsActive] = useState('');
  const [movementType, setMovementType] = useState('');
  const [createdAtFrom, setCreatedAtFrom] = useState('');
  const [createdAtTo, setCreatedAtTo] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditEntity, setAuditEntity] = useState('');
  const [auditUserId, setAuditUserId] = useState('');
  const [auditRecordId, setAuditRecordId] = useState('');
  const [sort, setSort] = useState('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState('20');
  const [showFilters, setShowFilters] = useState(true);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([]);
  const [statuses, setStatuses] = useState<ReferenceStatus[]>([]);
  const [employees, setEmployees] = useState<ReferenceEmployee[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearchRecord[]>([]);
  const [savedSearchId, setSavedSearchId] = useState('');
  const [savedName, setSavedName] = useState('');
  const [savedLoading, setSavedLoading] = useState(false);

  const availableResources = useMemo(
    () => SEARCH_RESOURCES.filter((item) => can(item.permission)),
    [can],
  );

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
    getLocationsTree().then(setLocations).catch(() => undefined);
    getStatuses().then(setStatuses).catch(() => undefined);
    getEmployees().then(setEmployees).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (availableResources.length > 0 && !availableResources.some((item) => item.value === resource)) {
      setResource(availableResources[0].value);
    }
  }, [availableResources, resource]);

  useEffect(() => {
    if (!can(PERMISSIONS.SEARCH_SAVE)) return;
    getSavedSearches().then(setSavedSearches).catch(() => undefined);
  }, [can]);

  const filters = useMemo(() => {
    if (resource === 'assets') {
      return {
        category_id: category ?? undefined,
        location_id: location ?? undefined,
        status_id: statusId ?? undefined,
        employee_id: employeeId ?? undefined,
        barcode: barcode.trim() || undefined,
        serial_number: serialNumber.trim() || undefined,
        reference_number: referenceNumber.trim() || undefined,
        purchase_date_from: purchaseDateFrom || undefined,
        purchase_date_to: purchaseDateTo || undefined,
        price_from: priceFrom.trim() || undefined,
        price_to: priceTo.trim() || undefined,
        is_active: isActive || undefined,
      };
    }
    if (resource === 'movements') {
      return {
        status: statusId ?? undefined,
        movement_type: movementType || undefined,
        created_at_from: createdAtFrom || undefined,
        created_at_to: createdAtTo || undefined,
      };
    }
    return {
      action: auditAction.trim() || undefined,
      entity: auditEntity.trim() || undefined,
      user_id: auditUserId.trim() || undefined,
      record_id: auditRecordId.trim() || undefined,
      created_at_from: createdAtFrom || undefined,
      created_at_to: createdAtTo || undefined,
    };
  }, [auditAction, auditEntity, auditRecordId, auditUserId, barcode, category, createdAtFrom, createdAtTo, employeeId, isActive, location, movementType, priceFrom, priceTo, purchaseDateFrom, purchaseDateTo, referenceNumber, resource, serialNumber, statusId]);

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const searchQuery = useStableSearchQuery({ q: query, filters, sort, dir, page, limit: safeLimit });
  const state = useAdvancedSearch(resource, searchQuery, availableResources.length > 0);
  const hasActiveFilters = Boolean(query.trim() || Object.values(filters).some((value) => value !== undefined));
  const sortOptions = SORT_OPTIONS[resource];

  const changeResource = (nextResource: SearchResource) => {
    if (nextResource === resource) return;
    setResource(nextResource);
    setQuery('');
    setCategory(null);
    setLocation(null);
    setStatusId(null);
    setEmployeeId(null);
    setBarcode('');
    setSerialNumber('');
    setReferenceNumber('');
    setPurchaseDateFrom('');
    setPurchaseDateTo('');
    setPriceFrom('');
    setPriceTo('');
    setIsActive('');
    setMovementType('');
    setCreatedAtFrom('');
    setCreatedAtTo('');
    setAuditAction('');
    setAuditEntity('');
    setAuditUserId('');
    setAuditRecordId('');
    setSort(defaultSort(nextResource));
    setDir(defaultDirection(nextResource));
    setPage(1);
  };

  const clearFilters = () => {
    setQuery('');
    setCategory(null);
    setLocation(null);
    setStatusId(null);
    setEmployeeId(null);
    setBarcode('');
    setSerialNumber('');
    setReferenceNumber('');
    setPurchaseDateFrom('');
    setPurchaseDateTo('');
    setPriceFrom('');
    setPriceTo('');
    setIsActive('');
    setMovementType('');
    setCreatedAtFrom('');
    setCreatedAtTo('');
    setAuditAction('');
    setAuditEntity('');
    setAuditUserId('');
    setAuditRecordId('');
    setPage(1);
  };

  const savedFilters = useMemo(() => ({ ...filters, q: query, sort, dir, limit: safeLimit }), [filters, query, sort, dir, safeLimit]);

  const applyCriteria = (criteria: { resource: SearchResource; filters: Record<string, unknown> }) => {
    const next = criteria.filters;
    setResource(criteria.resource);
    setQuery(asString(next.q));
    setCategory(asString(next.category_id) || null);
    setLocation(asString(next.location_id) || null);
    setStatusId(asString(next.status_id ?? next.status) || null);
    setEmployeeId(asString(next.employee_id) || null);
    setBarcode(asString(next.barcode));
    setSerialNumber(asString(next.serial_number));
    setReferenceNumber(asString(next.reference_number));
    setPurchaseDateFrom(asString(next.purchase_date_from));
    setPurchaseDateTo(asString(next.purchase_date_to));
    setPriceFrom(asString(next.price_from));
    setPriceTo(asString(next.price_to));
    setIsActive(asString(next.is_active));
    setMovementType(asString(next.movement_type));
    setCreatedAtFrom(asString(next.created_at_from));
    setCreatedAtTo(asString(next.created_at_to));
    setAuditAction(asString(next.action));
    setAuditEntity(asString(next.entity));
    setAuditUserId(asString(next.user_id));
    setAuditRecordId(asString(next.record_id));
    setSort(asString(next.sort) || defaultSort(criteria.resource));
    setDir(next.dir === 'desc' ? 'desc' : 'asc');
    setLimit(asString(next.limit) || '20');
    setPage(1);
  };

  const saveSearch = async () => {
    const name = savedName.trim();
    if (!name || name.length > 80) {
      toast.error(t('module.searchSaveFailed'), t('module.searchSaveNameInvalid'));
      return;
    }
    setSavedLoading(true);
    try {
      const saved = await createSavedSearch({ name, resource, filters: savedFilters });
      setSavedSearches((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setSavedSearchId(saved.id);
      setSavedName('');
      toast.success(t('module.searchSaved'), t('module.searchSavedMessage'));
    } catch (error) {
      toast.error(t('module.searchSaveFailed'), humanError(error));
    } finally {
      setSavedLoading(false);
    }
  };

  const applySavedSearch = async () => {
    if (!savedSearchId) return;
    setSavedLoading(true);
    try {
      applyCriteria(await executeSavedSearch(savedSearchId));
      toast.success(t('module.searchLoaded'), t('module.searchLoadedMessage'));
    } catch (error) {
      toast.error(t('module.searchLoadFailed'), humanError(error));
    } finally {
      setSavedLoading(false);
    }
  };

  const removeSavedSearch = async () => {
    if (!savedSearchId) return;
    const item = savedSearches.find((saved) => saved.id === savedSearchId);
    const ok = await confirm({ title: t('module.searchDeleteTitle'), message: item?.name ?? '', tone: 'warning', confirmLabel: t('common.delete') });
    if (!ok) return;
    setSavedLoading(true);
    try {
      await deleteSavedSearch(savedSearchId);
      setSavedSearches((items) => items.filter((saved) => saved.id !== savedSearchId));
      setSavedSearchId('');
      toast.success(t('module.searchDeleted'), t('module.searchDeletedMessage'));
    } catch (error) {
      toast.error(t('module.searchDeleteFailed'), humanError(error));
    } finally {
      setSavedLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.search')} subtitle={t('module.searchSubtitle')} />
      <CommandToolbar
        label={t('module.searchToolbar')}
        actions={[
          { id: 'focus-search', label: t('module.searchFocus'), icon: Search, onClick: () => searchInputRef.current?.focus(), variant: 'primary' },
          { id: 'toggle-filters', label: showFilters ? t('module.searchHideFilters') : t('module.searchShowFilters'), icon: ListFilter, onClick: () => setShowFilters((visible) => !visible) },
          { id: 'refresh', label: t('common.refresh'), icon: RefreshCw, onClick: state.reload, loading: state.status === 'loading' },
          { id: 'print', label: t('common.print'), icon: Printer, onClick: () => window.print(), separated: true },
          { id: 'reset-search', label: t('module.searchReset'), icon: Undo2, onClick: clearFilters, disabled: !hasActiveFilters },
        ]}
      />
      <Card>
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label={t('module.searchResource')}>
              <Select value={resource} onChange={(event) => changeResource(event.target.value as SearchResource)} aria-label={t('module.searchResource')}>
                {availableResources.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
              </Select>
            </Field>
            <Field label={t('module.searchSort')}>
              <Select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label={t('module.searchSort')}>
                {sortOptions.map((item) => <option key={item.value} value={item.value}>{t(item.labelKey)}</option>)}
              </Select>
            </Field>
            <Field label={t('module.searchDirection')}>
              <Select value={dir} onChange={(event) => { setDir(event.target.value as 'asc' | 'desc'); setPage(1); }} aria-label={t('module.searchDirection')}>
                <option value="asc">{t('module.searchAscending')}</option>
                <option value="desc">{t('module.searchDescending')}</option>
              </Select>
            </Field>
            <Field label={t('module.searchLimit')} hint={t('module.searchLimitHint')}>
              <Input type="number" min={1} max={100} step={1} value={limit} onChange={(event) => { setLimit(event.target.value); setPage(1); }} aria-label={t('module.searchLimit')} />
            </Field>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">{t('module.searchPlaceholder')}</span>
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
              <input ref={searchInputRef} className="ax-input w-full ps-9" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={t('module.searchPlaceholder')} aria-label={t('module.searchPlaceholder')} />
            </label>
          </div>

          {showFilters && (
            <div className="rounded-xl border border-line bg-surface-muted/35 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Filter className="h-4 w-4 text-brand" aria-hidden="true" />{t('module.searchFilters')}</div>
              {resource === 'assets' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SearchableSelect options={categories} value={category} onChange={(value) => { setCategory(value); setPage(1); }} placeholder={t('common.type')} />
                    <SearchableSelect options={locations} value={location} onChange={(value) => { setLocation(value); setPage(1); }} placeholder={t('common.location')} />
                    <SearchableSelect options={statuses.map((item) => ({ value: item.id, label: item.name }))} value={statusId} onChange={(value) => { setStatusId(value); setPage(1); }} placeholder={t('common.status')} />
                    <SearchableSelect options={employees.map((item) => ({ value: item.id, label: item.department ? `${item.name} · ${item.department}` : item.name }))} value={employeeId} onChange={(value) => { setEmployeeId(value); setPage(1); }} placeholder={t('module.searchEmployee')} />
                    <Field label={t('module.searchBarcode')}><Input value={barcode} onChange={(event) => { setBarcode(event.target.value); setPage(1); }} /></Field>
                    <Field label={t('module.searchSerialNumber')}><Input value={serialNumber} onChange={(event) => { setSerialNumber(event.target.value); setPage(1); }} /></Field>
                    <Field label={t('module.searchReference')}><Input value={referenceNumber} onChange={(event) => { setReferenceNumber(event.target.value); setPage(1); }} /></Field>
                    <Field label={t('module.searchActive')}><Select value={isActive} onChange={(event) => { setIsActive(event.target.value); setPage(1); }}><option value="">{t('module.searchAllStatuses')}</option><option value="true">{t('common.active')}</option><option value="false">{t('common.inactive')}</option></Select></Field>
                    <Field label={t('module.searchPurchaseDateFrom')}><Input type="date" value={purchaseDateFrom} onChange={(event) => { setPurchaseDateFrom(event.target.value); setPage(1); }} /></Field>
                    <Field label={t('module.searchPurchaseDateTo')}><Input type="date" value={purchaseDateTo} onChange={(event) => { setPurchaseDateTo(event.target.value); setPage(1); }} /></Field>
                    <Field label={t('module.searchPriceFrom')}><Input type="number" min={0} step="0.01" value={priceFrom} onChange={(event) => { setPriceFrom(event.target.value); setPage(1); }} /></Field>
                    <Field label={t('module.searchPriceTo')}><Input type="number" min={0} step="0.01" value={priceTo} onChange={(event) => { setPriceTo(event.target.value); setPage(1); }} /></Field>
                  </div>
                </>
              )}
              {resource === 'movements' && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label={t('common.status')}><Select value={statusId ?? ''} onChange={(event) => { setStatusId(event.target.value || null); setPage(1); }}><option value="">{t('module.searchAllStatuses')}</option><option value="pending">{t('movementStatus.pending')}</option><option value="approved">{t('movementStatus.approved')}</option><option value="rejected">{t('movementStatus.rejected')}</option></Select></Field>
                  <Field label={t('module.searchMovementType')}><Select value={movementType} onChange={(event) => { setMovementType(event.target.value); setPage(1); }}><option value="">{t('module.searchAllTypes')}</option>{['transfer', 'assignment', 'return', 'maintenance_return', 'disposal', 'retirement', 'missing'].map((item) => <option key={item} value={item}>{t(`movementType.${item}`, item)}</option>)}</Select></Field>
                  <Field label={t('module.searchDateFrom')}><Input type="date" value={createdAtFrom} onChange={(event) => { setCreatedAtFrom(event.target.value); setPage(1); }} /></Field>
                  <Field label={t('module.searchDateTo')}><Input type="date" value={createdAtTo} onChange={(event) => { setCreatedAtTo(event.target.value); setPage(1); }} /></Field>
                </div>
              )}
              {resource === 'audit' && (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Field label={t('module.searchAction')}><Input value={auditAction} onChange={(event) => { setAuditAction(event.target.value); setPage(1); }} /></Field>
                  <Field label={t('module.searchEntity')}><Input value={auditEntity} onChange={(event) => { setAuditEntity(event.target.value); setPage(1); }} /></Field>
                  <Field label={t('module.searchUserId')}><Input value={auditUserId} onChange={(event) => { setAuditUserId(event.target.value); setPage(1); }} /></Field>
                  <Field label={t('module.searchRecordId')}><Input value={auditRecordId} onChange={(event) => { setAuditRecordId(event.target.value); setPage(1); }} /></Field>
                  <Field label={t('module.searchDateFrom')}><Input type="date" value={createdAtFrom} onChange={(event) => { setCreatedAtFrom(event.target.value); setPage(1); }} /></Field>
                  <Field label={t('module.searchDateTo')}><Input type="date" value={createdAtTo} onChange={(event) => { setCreatedAtTo(event.target.value); setPage(1); }} /></Field>
                </div>
              )}
              {hasActiveFilters && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3"><p className="text-xs text-ink-muted">{t('module.searchActiveFilters')}</p><Button variant="ghost" size="sm" onClick={clearFilters}><FilterX className="h-3.5 w-3.5" aria-hidden="true" />{t('module.searchClearFilters')}</Button></div>
              )}
            </div>
          )}

          {can(PERMISSIONS.SEARCH_SAVE) && (
            <div className="grid gap-3 rounded-xl border border-line bg-surface-muted/20 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              <Field label={t('module.searchSavedSelect')}>
                <Select value={savedSearchId} onChange={(event) => setSavedSearchId(event.target.value)}><option value="">{t('module.searchChooseSaved')}</option>{savedSearches.map((item) => <option key={item.id} value={item.id}>{item.name} · {t(`module.searchResource.${item.resource}`)}</option>)}</Select>
              </Field>
              <Field label={t('module.searchSaveName')} hint={t('module.searchSaveNameHint')}><Input value={savedName} maxLength={80} onChange={(event) => setSavedName(event.target.value)} placeholder={t('module.searchSaveNamePlaceholder')} /></Field>
              <Button variant="secondary" size="sm" disabled={!savedSearchId || savedLoading} loading={savedLoading} title={t('module.searchApplySaved')} aria-label={t('module.searchApplySaved')} onClick={() => void applySavedSearch()}><Search className="h-4 w-4" /></Button>
              <div className="flex gap-1"><Button variant="secondary" size="sm" disabled={!savedName.trim() || savedLoading} loading={savedLoading} title={t('module.searchSave')} aria-label={t('module.searchSave')} onClick={() => void saveSearch()}><Save className="h-4 w-4" /></Button><Button variant="ghost" size="sm" disabled={!savedSearchId || savedLoading} title={t('module.searchDelete')} aria-label={t('module.searchDelete')} onClick={() => void removeSavedSearch()}><Trash2 className="h-4 w-4 text-danger" /></Button></div>
            </div>
          )}

          <AsyncBoundary state={state}>
            {(data) => data.items.length === 0 ? (
              <EmptyState title={t('module.searchNoResults')} description={t('module.searchNoResultsDesc')} />
            ) : (
              <>
                <CardHeader title={t('module.searchResults')} subtitle={`${data.total.toLocaleString()} ${t('module.searchResultCount')} · ${t('module.searchPage')} ${data.page}`} />
                <div className="divide-y divide-line" aria-live="polite">
                  {data.items.map((item) => resource === 'assets' ? renderAssetResult(item, t) : resource === 'movements' ? renderMovementResult(item, t) : renderAuditResult(item, t))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <span className="text-xs text-ink-muted">{t('module.searchPageSummary').replace('{page}', String(data.page)).replace('{limit}', String(data.limit))}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" disabled={data.page <= 1 || state.status === 'loading'} title={t('module.searchPrevious')} aria-label={t('module.searchPrevious')} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Button>
                    <Button variant="ghost" size="sm" disabled={!data.hasMore || state.status === 'loading'} title={t('module.searchNext')} aria-label={t('module.searchNext')} onClick={() => setPage((current) => current + 1)}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
                  </div>
                </div>
              </>
            )}
          </AsyncBoundary>
        </CardBody>
      </Card>
    </div>
  );
}
