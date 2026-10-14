'use client';

import { DatabaseBackup } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useI18n } from '@/lib/i18n';

/** Backups run on the database server (a scheduled task), so this card only explains them. */
export function BackupInfoCard() {
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader title={t('backup.title')} subtitle={t('backup.desc')} />
      <CardBody>
        <div className="flex items-start gap-3">
          <DatabaseBackup className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint" />
          <div className="space-y-2 text-sm text-ink-muted">
            <p>{t('backup.how')}</p>
            <p>
              <span className="font-medium text-ink">{t('backup.where')}: </span>
              <bdi dir="ltr">{t('backup.whereValue')}</bdi>
            </p>
            <p>{t('backup.manage')}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
