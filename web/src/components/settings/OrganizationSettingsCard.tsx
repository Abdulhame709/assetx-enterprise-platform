'use client';

import { useRef, useState } from 'react';
import { ImageUp, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/form';
import { useToast } from '@/components/ui/Toast';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { useI18n } from '@/lib/i18n';
import { useCan } from '@/lib/auth/session-context';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { humanError } from '@/lib/api/errors';
import { useAsync } from '@/lib/use-async';
import {
  OrganizationSettings, ReportOrientation, clearLogo, getSettings, setLogo, updateSettings,
} from '@/features/settings/api';
import { setBranding } from '@/features/settings/branding';
import { prepareLogo } from '@/features/settings/logo-image';

/** Organization settings — official name, logo and report defaults (applies to every report). */
export function OrganizationSettingsCard() {
  const { t } = useI18n();
  const state = useAsync<OrganizationSettings>(() => getSettings(), []);
  return (
    <Card>
      <CardHeader title={t('org.title')} subtitle={t('org.desc')} />
      <CardBody>
        <AsyncBoundary state={state}>{(data) => <OrganizationForm initial={data} />}</AsyncBoundary>
      </CardBody>
    </Card>
  );
}

function OrganizationForm({ initial }: { initial: OrganizationSettings }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const canEdit = useCan()(PERMISSIONS.SETTINGS_UPDATE);
  const [saved, setSaved] = useState<OrganizationSettings>(initial);
  const [name, setName] = useState(initial.organization_name);
  const [signatures, setSignatures] = useState(initial.report_signatures);
  const [orientation, setOrientation] = useState<ReportOrientation>(initial.report_orientation);
  const [busy, setBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const apply = (s: OrganizationSettings) => {
    setSaved(s);
    setName(s.organization_name);
    setSignatures(s.report_signatures);
    setOrientation(s.report_orientation);
    setBranding({ organization_name: s.organization_name, logo: s.logo });
  };

  const dirty = (
    name.trim() !== saved.organization_name || signatures !== saved.report_signatures || orientation !== saved.report_orientation
  );

  async function run(action: () => Promise<OrganizationSettings>, success: string, description?: string) {
    setBusy(true);
    try {
      apply(await action());
      toast.success(success, description);
    } catch (err) {
      toast.error(t('common.error'), humanError(err, undefined, locale));
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setLogoError(null);
    let dataUri: string;
    try {
      dataUri = await prepareLogo(file);
    } catch {
      setLogoError(t('org.logoBad'));
      return;
    }
    await run(() => setLogo(dataUri), t('org.logoSaved'));
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="space-y-6">
      {!canEdit && <p className="text-sm text-ink-muted">{t('org.readOnly')}</p>}

      <Field label={t('org.name')} hint={t('org.nameHint')}>
        <Input value={name} maxLength={120} disabled={!canEdit || busy} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label={t('org.logo')} hint={t('org.logoHint')} error={logoError ?? undefined}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-lg border border-dashed border-line bg-surface-muted/50">
            {saved.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={saved.logo} alt={t('org.logo')} className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="px-2 text-center text-xs text-ink-faint">{t('org.logoNone')}</span>
            )}
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              <Button variant="secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                <ImageUp className="h-4 w-4" /> {saved.logo ? t('org.logoReplace') : t('org.logoChoose')}
              </Button>
              {saved.logo && (
                <Button variant="ghost" disabled={busy} onClick={() => void run(() => clearLogo(), t('org.logoRemoved'))}>
                  <Trash2 className="h-4 w-4" /> {t('org.logoRemove')}
                </Button>
              )}
            </div>
          )}
        </div>
      </Field>

      <div className="space-y-3">
        <p className="ax-label">{t('org.options')}</p>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-1"
            checked={signatures}
            disabled={!canEdit || busy}
            onChange={(e) => setSignatures(e.target.checked)}
          />
          <span>
            {t('org.signatures')}
            <span className="block text-xs text-ink-faint">{t('org.signaturesHint')}</span>
          </span>
        </label>
        <Field label={t('org.orientation')}>
          <Select value={orientation} disabled={!canEdit || busy} onChange={(e) => setOrientation(e.target.value as ReportOrientation)}>
            <option value="auto">{t('org.orientationAuto')}</option>
            <option value="portrait">{t('org.orientationPortrait')}</option>
            <option value="landscape">{t('org.orientationLandscape')}</option>
          </Select>
        </Field>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button
            loading={busy}
            disabled={!dirty || name.trim().length < 2}
            onClick={() => void run(
              () => updateSettings({ organization_name: name.trim(), report_signatures: signatures, report_orientation: orientation }),
              t('org.saved'),
              t('org.savedDesc'),
            )}
          >
            {t('org.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
