'use client';

import { useMemo, useRef, useState } from 'react';
import { Building2, FileSpreadsheet, Mail, Pencil, Phone, Plus, Printer, RefreshCw, Search, Undo2, UserRoundCheck, UsersRound, UserX } from 'lucide-react';
import { deleteEmployee, getEmployees, ReferenceEmployee } from '@/features/reference/api';
import { EmployeeFormModal } from '@/features/reference/components/EmployeeFormModal';
import { useAsync } from '@/lib/use-async';
import { useI18n } from '@/lib/i18n';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommandToolbar } from '@/components/ui/CommandToolbar';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/Button';
import { EnterpriseTable, EColumn } from '@/components/ui/EnterpriseTable';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { humanError } from '@/lib/api/errors';

export default function EmployeesPage() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { data, status, error, reload } = useAsync<ReferenceEmployee[]>(getEmployees, [], { isEmpty: (rows) => rows.length === 0 });
  const [editing, setEditing] = useState<ReferenceEmployee | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const employees = data ?? [];
  const filteredEmployees = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) return employees;
    return employees.filter((employee) => [employee.name, employee.department, employee.email, employee.phone]
      .some((value) => value?.toLocaleLowerCase(locale).includes(normalized)));
  }, [employees, locale, query]);
  const departmentCount = new Set(employees.map((employee) => employee.department).filter(Boolean)).size;
  const completeContactCount = employees.filter((employee) => employee.email || employee.phone).length;
  const noContactCount = employees.length - completeContactCount;

  const disable = async (employee: ReferenceEmployee) => {
    const approved = await confirm({ title: t('employees.disable'), message: t('employees.disableMessage'), tone: 'danger', confirmLabel: t('employees.disable') });
    if (!approved) return;
    setDeleting(employee.id);
    try {
      await deleteEmployee(employee.id);
      toast.success(t('employees.disabled'), employee.name);
      reload();
    } catch (err) {
      toast.error(t('employees.disable'), humanError(err, t('common.genericError'), locale));
    } finally { setDeleting(null); }
  };

  const columns: EColumn<ReferenceEmployee>[] = [
    {
      key: 'name', header: t('employees.name'), sortable: true,
      render: (employee) => <div className="flex min-w-44 items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><UserRoundCheck className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate font-semibold text-ink">{employee.name}</p><p className="truncate text-xs text-ink-faint">{employee.department ?? t('employees.noDepartment')}</p></div></div>,
    },
    {
      key: 'department', header: t('employees.department'), sortable: true,
      render: (employee) => employee.department ? <span className="inline-flex items-center gap-1.5 text-ink-muted"><Building2 className="h-3.5 w-3.5 text-ink-faint" />{employee.department}</span> : <span className="text-ink-faint">—</span>,
    },
    {
      key: 'contact', header: t('employees.contact'),
      render: (employee) => <div className="space-y-1 text-xs text-ink-muted">{employee.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-ink-faint" />{employee.email}</p>}{employee.phone && <p className="flex items-center gap-1.5" dir="ltr"><Phone className="h-3.5 w-3.5 text-ink-faint" />{employee.phone}</p>}{!employee.email && !employee.phone && <span className="text-ink-faint">{t('employees.noContact')}</span>}</div>,
    },
    {
      key: 'actions', header: t('employees.actions'), align: 'left', width: '104px',
      render: (employee) => <div className="flex items-center justify-end gap-1"><PermissionGate permission={PERMISSIONS.EMPLOYEE_UPDATE}><Button variant="secondary" size="sm" className="h-8 w-8 p-0" aria-label={t('employees.edit')} title={t('employees.edit')} onClick={() => setEditing(employee)}><Pencil className="h-3.5 w-3.5" /></Button></PermissionGate><PermissionGate permission={PERMISSIONS.EMPLOYEE_DELETE}><Button variant="danger" size="sm" className="h-8 w-8 p-0" aria-label={t('employees.disable')} title={t('employees.disable')} loading={deleting === employee.id} onClick={() => void disable(employee)}><UserX className="h-3.5 w-3.5" /></Button></PermissionGate></div>,
    },
  ];

  return <div className="space-y-4">
    <PageHeader title={t('nav.employees')} subtitle={t('employees.subtitle')} />

    <CommandToolbar
      label={t('employees.commandToolbar')}
      actions={[
        { id: 'search', label: t('employees.searchCommand'), icon: Search, onClick: () => searchInputRef.current?.focus(), variant: 'primary' },
        { id: 'refresh', label: t('common.refresh'), icon: RefreshCw, onClick: reload, loading: status === 'loading' },
        { id: 'print', label: t('common.print'), icon: Printer, onClick: () => window.print(), separated: true },
        { id: 'import', label: t('assets.importExcel'), icon: FileSpreadsheet, href: '/import-data?resource=employees', permission: PERMISSIONS.EMPLOYEE_CREATE, separated: true },
        { id: 'add', label: t('employees.new'), icon: Plus, onClick: () => setEditing(null), permission: PERMISSIONS.EMPLOYEE_CREATE, variant: 'primary' },
        { id: 'reset', label: t('employees.clearSearch'), icon: Undo2, onClick: () => setQuery(''), disabled: !query },
      ]}
    />

    <section aria-label={t('employees.metrics')} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard icon={UsersRound} label={t('employees.total')} value={employees.length.toLocaleString(locale)} tone="brand" />
      <MetricCard icon={Building2} label={t('employees.departments')} value={departmentCount.toLocaleString(locale)} tone="warning" />
      <MetricCard icon={Mail} label={t('employees.withContact')} value={completeContactCount.toLocaleString(locale)} tone="success" />
      <MetricCard icon={UserX} label={t('employees.missingContact')} value={noContactCount.toLocaleString(locale)} tone="danger" />
    </section>

    <section className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4" aria-labelledby="employee-controls-title">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="employee-controls-title" className="text-sm font-semibold text-ink">{t('employees.controlsTitle')}</h2><p className="text-xs text-ink-muted">{t('employees.resultsSummary').replace('{shown}', String(filteredEmployees.length)).replace('{total}', String(employees.length))}</p></div>
      </div>
      <label className="relative block max-w-xl"><span className="sr-only">{t('employees.search')}</span><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" /><input ref={searchInputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('employees.search')} className="ax-input w-full py-2 ps-9" /></label>
    </section>

    <Card className="overflow-hidden p-0 shadow-card"><CardBody className="p-0">
      <EnterpriseTable columns={columns} rows={filteredEmployees} rowKey={(employee) => employee.id} loading={status === 'loading'} error={status === 'error' ? humanError(error, t('common.genericError'), locale) : null} onRetry={reload} sortKey="name" sortDir="asc" empty={<EmptyState title={query ? t('employees.noMatch') : t('employees.none')} description={query ? t('employees.noMatchDesc') : t('employees.noneDesc')} />} />
    </CardBody></Card>
    {editing !== undefined && <EmployeeFormModal open employee={editing} onClose={() => setEditing(undefined)} onSaved={reload} />}
  </div>;
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof UsersRound; label: string; value: string; tone: 'brand' | 'success' | 'warning' | 'danger' }) {
  const toneClass = { brand: 'bg-brand-soft text-brand', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger' }[tone];
  return <div className="rounded-xl border border-line bg-surface-raised p-3 shadow-card sm:p-4"><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-lg ${toneClass}`}><Icon className="h-4 w-4" /></span><span className="text-2xl font-semibold tabular-nums text-ink">{value}</span></div><p className="mt-3 text-xs font-medium text-ink-muted">{label}</p></div>;
}
