'use client';

import { getEmployees, ReferenceEmployee } from '@/features/reference/api';
import { useAsync } from '@/lib/use-async';
import { useI18n } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';

export default function EmployeesPage() {
  const { t } = useI18n();
  const { data, status, error, reload } = useAsync<ReferenceEmployee[]>(getEmployees, [], {
    isEmpty: (rows) => rows.length === 0,
  });

  return (
    <div>
      <PageHeader title={t('nav.employees')} subtitle={t('placeholder.employeeSubtitle')} />
      <Card>
        <CardBody>
          {status === 'loading' && <p className="py-8 text-center text-sm text-ink-muted">{t('common.loading')}</p>}
          {status === 'error' && (
            <div className="py-8 text-center">
              <p className="text-sm text-danger">{error ?? t('common.noData')}</p>
              <button className="mt-3 rounded-lg border border-line px-3 py-2 text-sm" onClick={reload}>{t('common.refresh')}</button>
            </div>
          )}
          {status === 'empty' && <EmptyState title={t('nav.employees')} description={t('common.noData')} />}
          {status === 'success' && data && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-start text-sm">
                <thead className="border-b border-line text-xs uppercase text-ink-faint">
                  <tr>
                    <th className="px-3 py-3 font-semibold">{t('nav.employees')}</th>
                    <th className="px-3 py-3 font-semibold">{t('nav.masterData')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.map((employee) => (
                    <tr key={employee.id} className="hover:bg-surface-muted">
                      <td className="px-3 py-3 font-medium text-ink">{employee.name}</td>
                      <td className="px-3 py-3 text-ink-muted">{employee.department ?? t('common.none')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
