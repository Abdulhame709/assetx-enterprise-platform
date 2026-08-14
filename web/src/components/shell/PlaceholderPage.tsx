'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { useI18n } from '@/lib/i18n';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';

/**
 * PlaceholderPage — temporary stand-in for module routes not yet implemented.
 * Establishes the shell + navigation; business screens land in later phases.
 */
export function PlaceholderPage({
  title,
  subtitle,
  titleKey,
  subtitleKey,
}: {
  title: string;
  subtitle?: string;
  titleKey?: string;
  subtitleKey?: string;
}) {
  const { t } = useI18n();
  const resolvedTitle = titleKey ? t(titleKey, title) : title;
  const resolvedSubtitle = subtitleKey ? t(subtitleKey, subtitle) : subtitle;
  return (
    <div>
      <PageHeader title={resolvedTitle} subtitle={resolvedSubtitle} />
      <Card>
        <CardBody>
          <EmptyState
            title={resolvedTitle}
            description={t('placeholder.planned')}
          />
        </CardBody>
      </Card>
    </div>
  );
}
