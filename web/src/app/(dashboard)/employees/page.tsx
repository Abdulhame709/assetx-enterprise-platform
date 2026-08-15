'use client';

import { useState } from 'react';
import { Pencil, Plus, UserX } from 'lucide-react';
import { deleteEmployee, getEmployees, ReferenceEmployee } from '@/features/reference/api';
import { EmployeeFormModal } from '@/features/reference/components/EmployeeFormModal';
import { useAsync } from '@/lib/use-async';
import { useI18n } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/Button';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { humanError } from '@/lib/api/errors';

export default function EmployeesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { data, status, error, reload } = useAsync<ReferenceEmployee[]>(getEmployees, [], { isEmpty: (rows) => rows.length === 0 });
  const [editing, setEditing] = useState<ReferenceEmployee | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<string | null>(null);

  const disable = async (employee: ReferenceEmployee) => {
    const approved = await confirm({ title: t('employees.disable'), message: t('employees.disableMessage'), tone: 'danger', confirmLabel: t('employees.disable') });
    if (!approved) return;
    setDeleting(employee.id);
    try {
      await deleteEmployee(employee.id);
      toast.success(t('employees.disabled'), employee.name);
      reload();
    } catch (err) {
      toast.error(t('employees.disable'), humanError(err));
    } finally { setDeleting(null); }
  };

  return <div>
    <PageHeader title={t('nav.employees')} subtitle={t('employees.subtitle')} actions={<PermissionGate permission={PERMISSIONS.EMPLOYEE_CREATE}><Button variant="primary" size="sm" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> {t('employees.new')}</Button></PermissionGate>} />
    <Card><CardBody>
      {status === 'loading' && <p className="py-8 text-center text-sm text-ink-muted">{t('common.loading')}</p>}
      {status === 'error' && <div className="py-8 text-center"><p className="text-sm text-danger">{error ?? t('common.noData')}</p><Button className="mt-3" variant="secondary" size="sm" onClick={reload}>{t('common.refresh')}</Button></div>}
      {status === 'empty' && <EmptyState title={t('employees.none')} description={t('employees.noneDesc')} />}
      {status === 'success' && data && <div className="overflow-x-auto"><table className="min-w-full text-start text-sm"><thead className="border-b border-line text-xs uppercase text-ink-faint"><tr><th className="px-3 py-3 font-semibold">{t('employees.name')}</th><th className="px-3 py-3 font-semibold">{t('employees.department')}</th><th className="px-3 py-3 font-semibold">{t('employees.contact')}</th><th className="px-3 py-3 font-semibold">{t('common.details')}</th></tr></thead><tbody className="divide-y divide-line">{data.map((employee) => <tr key={employee.id} className="hover:bg-surface-muted"><td className="px-3 py-3 font-medium text-ink">{employee.name}</td><td className="px-3 py-3 text-ink-muted">{employee.department ?? '—'}</td><td className="px-3 py-3 text-ink-muted">{employee.email ?? employee.phone ?? '—'}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><PermissionGate permission={PERMISSIONS.EMPLOYEE_UPDATE}><Button variant="secondary" size="sm" onClick={() => setEditing(employee)}><Pencil className="h-3.5 w-3.5" /> {t('employees.edit')}</Button></PermissionGate><PermissionGate permission={PERMISSIONS.EMPLOYEE_DELETE}><Button variant="danger" size="sm" loading={deleting === employee.id} onClick={() => void disable(employee)}><UserX className="h-3.5 w-3.5" /> {t('employees.disable')}</Button></PermissionGate></div></td></tr>)}</tbody></table></div>}
    </CardBody></Card>
    {editing !== undefined && <EmployeeFormModal open employee={editing} onClose={() => setEditing(undefined)} onSaved={reload} />}
  </div>;
}
