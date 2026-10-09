'use client';

import { Check } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { LocationTypeManager } from '@/features/location-types/components/LocationTypeManager';
import { useI18n } from '@/lib/i18n';
import { useCan } from '@/lib/auth/session-context';
import { PERMISSIONS } from '@/lib/auth/permissions';

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n();
  const can = useCan();
  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.settings')} subtitle={t('module.settingsSubtitle')} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title={t('module.settingsLanguage')} subtitle={t('module.settingsLanguageDesc')} />
          <CardBody>
            <div className="flex flex-wrap gap-2">
              <Button variant={locale === 'ar' ? 'primary' : 'secondary'} onClick={() => setLocale('ar')}>
                {locale === 'ar' && <Check className="h-4 w-4" />} {t('module.settingsArabic')}
              </Button>
              <Button variant={locale === 'en' ? 'primary' : 'secondary'} onClick={() => setLocale('en')}>
                {locale === 'en' && <Check className="h-4 w-4" />} {t('module.settingsEnglish')}
              </Button>
            </div>
            <p className="mt-4 text-sm text-ink-muted">{t('module.settingsCurrent')}: {locale === 'ar' ? t('module.settingsArabic') : t('module.settingsEnglish')}</p>
          </CardBody>
        </Card>
        <ThemePicker />
      </div>
      {can(PERMISSIONS.LOCATION_TYPE_VIEW) && <LocationTypeManager />}
    </div>
  );
}
