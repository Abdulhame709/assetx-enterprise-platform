'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/form';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';
import { createEmployee, ReferenceEmployee, updateEmployee } from '../api';

interface Props {
  open: boolean;
  employee: ReferenceEmployee | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EmployeeFormModal({ open, employee, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(employee?.name ?? '');
    setDepartment(employee?.department ?? '');
    setPhone(employee?.phone ?? '');
    setEmail(employee?.email ?? '');
    setError(null);
  }, [open, employee]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) { setError(t('employees.nameTooShort')); return; }
    setSaving(true);
    setError(null);
    const input = { name: name.trim(), department: department.trim() || undefined, phone: phone.trim() || undefined, email: email.trim() || undefined };
    try {
      if (employee) await updateEmployee(employee.id, input);
      else await createEmployee(input);
      onSaved();
      onClose();
    } catch (err) {
      setError(humanError(err));
    } finally {
      setSaving(false);
    }
  };

  return <Modal open={open} onClose={onClose} title={employee ? t('employees.edit') : t('employees.new')} size="md">
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('employees.name')}><Input value={name} onChange={(event) => setName(event.target.value)} autoFocus required /></Field>
      <Field label={t('employees.department')}><Input value={department} onChange={(event) => setDepartment(event.target.value)} /></Field>
      <Field label={t('employees.phone')}><Input value={phone} onChange={(event) => setPhone(event.target.value)} /></Field>
      <Field label={t('employees.email')}><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" variant="primary" size="sm" loading={saving}>{t('assetForm.save')}</Button></div>
    </form>
  </Modal>;
}
