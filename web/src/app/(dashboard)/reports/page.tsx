'use client';

import { Download } from 'lucide-react';
import { AsyncBoundary } from '@/components/ui/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { useAnalytics } from '@/features/assets/use-assets';
import { downloadAssetExport } from '@/features/assets/api';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';
import { useState } from 'react';

export default function ReportsPage() {
  const state = useAnalytics();
  const toast = useToast();
  const { t, locale } = useI18n();
  const [exporting, setExporting] = useState(false);
  const download = async () => {
    setExporting(true);
    try {
      await downloadAssetExport('csv');
      toast.success(t('module.reportsExportReady'), t('module.reportsExportMessage'));
    } catch (error) {
      toast.error(t('module.reportsExportFailed'), humanError(error));
    } finally { setExporting(false); }
  };
  return (
    <div>
      <PageHeader title={t('nav.reports')} subtitle={t('module.reportsSubtitle')} />
      <AsyncBoundary state={state}>
        {(data) => (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <KpiCard label={t('module.reportsTotal')} value={data.total_assets.toLocaleString(locale)} tone="info" />
            <KpiCard label={t('module.reportsActive')} value={data.active_assets.toLocaleString(locale)} tone="success" />
            <Card>
              <CardHeader title={t('module.reportsExportTitle')} subtitle={t('module.reportsExportDesc')} />
              <CardBody>
                <Button variant="primary" onClick={() => void download()} loading={exporting}>
                  <Download className="h-4 w-4" /> {t('module.reportsExport')}
                </Button>
              </CardBody>
            </Card>
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}
