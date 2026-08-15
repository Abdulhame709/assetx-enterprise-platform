'use client';

import { Download } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useI18n } from '@/lib/i18n';

export default function ImportDataPage() {
  const { t } = useI18n();
  const toast = useToast();
  const downloadTemplate = () => {
    const csv = 'name,category,location,status,quantity,purchase_price\nمثال أصل,تقنية المعلومات,المبنى الرئيسي,نشط,1,0\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'assetx-assets-import-template.csv'; anchor.click();
    URL.revokeObjectURL(url);
    toast.success(t('module.importDownloaded'), t('module.importTemplateTitle'));
  };
  return (
    <div>
      <PageHeader title={t('nav.importData')} subtitle={t('module.importSubtitle')} />
      <Card>
        <CardHeader title={t('module.importTemplateTitle')} subtitle={t('module.importTemplateDesc')} />
        <CardBody><Button variant="primary" onClick={downloadTemplate}><Download className="h-4 w-4" /> {t('module.importTemplate')}</Button></CardBody>
      </Card>
    </div>
  );
}
