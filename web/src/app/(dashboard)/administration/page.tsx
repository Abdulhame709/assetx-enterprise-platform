'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';
import { useSession } from '@/lib/auth/session-context';
import { useI18n } from '@/lib/i18n';

export default function AdministrationPage() {
  const { session } = useSession();
  const { t, locale } = useI18n();
  return (
    <div>
      <PageHeader title={t('nav.administrationPage')} subtitle={t('module.adminSubtitle')} />
      {!session ? <EmptyState title={t('module.adminNoSession')} /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={t('module.adminUser')} />
            <CardBody className="space-y-2 text-sm">
              <p><span className="text-ink-muted">{t('common.name')}:</span> {session.user.displayName}</p>
              <p><span className="text-ink-muted">{t('module.adminRoles')}:</span> {session.user.roles.join('، ') || '—'}</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t('module.adminTenant')} />
            <CardBody className="space-y-2 text-sm">
              <p><span className="text-ink-muted">{t('common.name')}:</span> {session.tenant.name}</p>
              <p><span className="text-ink-muted">{t('common.code')}:</span> {session.tenant.code}</p>
              <p><span className="text-ink-muted">{t('module.adminPermissions')}:</span> {session.permissions.length.toLocaleString(locale)}</p>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
