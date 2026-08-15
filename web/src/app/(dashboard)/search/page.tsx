'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAssetList } from '@/features/assets/use-assets';
import { useI18n } from '@/lib/i18n';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const state = useAssetList({ q: query, page: 1, limit: 20 });
  const { t } = useI18n();
  return (
    <div>
      <PageHeader title={t('nav.search')} subtitle={t('module.searchSubtitle')} />
      <Card>
        <CardBody>
          <input className="ax-input mb-4 w-full" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('module.searchPlaceholder')} aria-label={t('module.searchPlaceholder')} />
          <AsyncBoundary state={state}>
            {(data) => data.items.length === 0 ? (
              <EmptyState title={t('module.searchNoResults')} description={t('module.searchNoResultsDesc')} />
            ) : (
              <>
                <CardHeader title={t('module.searchResults')} />
                <div className="divide-y divide-line">
                  {data.items.map((asset) => (
                    <Link key={asset.id} href={`/assets/${asset.id}`} className="block py-3 hover:bg-surface-muted/50">
                      <p className="font-medium text-brand">{asset.name}</p>
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
