'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Filter, FilterX, ListFilter, Search } from 'lucide-react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { getCategories } from '@/features/assets/api';
import { getLocationsTree } from '@/features/assets/components/reference-selects';
import { useAssetList } from '@/features/assets/use-assets';
import { getEmployees, getStatuses, type ReferenceEmployee, type ReferenceStatus } from '@/features/reference/api';
import { useI18n } from '@/lib/i18n';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);
  const [locations, setLocations] = useState<{ value: string; label: string }[]>([]);
  const [statuses, setStatuses] = useState<ReferenceStatus[]>([]);
  const [employees, setEmployees] = useState<ReferenceEmployee[]>([]);
  const { t } = useI18n();

  useEffect(() => {
    getCategories().then(setCategories).catch(() => undefined);
    getLocationsTree().then(setLocations).catch(() => undefined);
    getStatuses().then(setStatuses).catch(() => undefined);
    getEmployees().then(setEmployees).catch(() => undefined);
  }, []);

  const state = useAssetList({
    q: query,
    category_id: category ?? undefined,
    location_id: location ?? undefined,
    status_id: statusId ?? undefined,
    employee_id: employeeId ?? undefined,
    page: 1,
    limit: 30,
  });
  const hasActiveFilters = Boolean(query.trim() || category || location || statusId || employeeId);

  const clearFilters = () => {
    setQuery('');
    setCategory(null);
    setLocation(null);
    setStatusId(null);
    setEmployeeId(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.search')} subtitle={t('module.searchSubtitle')} />
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block min-w-0 flex-1">
              <span className="sr-only">{t('module.searchPlaceholder')}</span>
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
              <input
                className="ax-input w-full ps-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('module.searchPlaceholder')}
                aria-label={t('module.searchPlaceholder')}
              />
            </label>
            <Button variant="secondary" size="sm" onClick={() => setShowFilters((visible) => !visible)} aria-expanded={showFilters}>
              <ListFilter className="h-4 w-4" aria-hidden="true" />
              {showFilters ? t('module.searchHideFilters') : t('module.searchShowFilters')}
            </Button>
          </div>

          {showFilters && (
            <div className="rounded-xl border border-line bg-surface-muted/35 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                <Filter className="h-4 w-4 text-brand" aria-hidden="true" />
                {t('module.searchFilters')}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SearchableSelect options={categories} value={category} onChange={setCategory} placeholder={t('common.type')} />
                <SearchableSelect options={locations} value={location} onChange={setLocation} placeholder={t('common.location')} />
                <SearchableSelect options={statuses.map((item) => ({ value: item.id, label: item.name }))} value={statusId} onChange={setStatusId} placeholder={t('common.status')} />
                <SearchableSelect options={employees.map((item) => ({ value: item.id, label: item.department ? `${item.name} · ${item.department}` : item.name }))} value={employeeId} onChange={setEmployeeId} placeholder={t('module.searchEmployee')} />
              </div>
              {hasActiveFilters && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <p className="text-xs text-ink-muted">{t('module.searchActiveFilters')}</p>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <FilterX className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('module.searchClearFilters')}
                  </Button>
                </div>
              )}
            </div>
          )}

          <AsyncBoundary state={state}>
            {(data) => data.items.length === 0 ? (
              <EmptyState title={t('module.searchNoResults')} description={t('module.searchNoResultsDesc')} />
            ) : (
              <>
                <CardHeader title={t('module.searchResults')} subtitle={`${data.total.toLocaleString()} ${t('module.searchResultCount')}`} />
                <div className="divide-y divide-line" aria-live="polite">
                  {data.items.map((asset) => (
                    <Link key={asset.id} href={`/assets/${asset.id}`} className="block rounded-lg px-2 py-3 transition-colors hover:bg-surface-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <p className="font-medium text-brand">{asset.name}</p>
                        <p className="text-xs text-ink-muted">{asset._statusName ?? '—'} · {asset._employeeName ?? t('module.searchUnassigned')}</p>
                      </div>
                      <p className="text-xs text-ink-muted">{t('module.searchCode')}: {asset.full_asset_code} · {t('module.searchLocation')}: {asset._locationName ?? '—'}</p>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </AsyncBoundary>
        </CardBody>
      </Card>
    </div>
  );
}
