'use client';

import { FormEvent, useState } from 'react';
import { Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/states';
import { Field, Input } from '@/components/ui/form';
import { Modal } from '@/components/ui/Modal';
import { useCan } from '@/lib/auth/session-context';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { formatCurrency, formatDate } from '@/lib/format';
import { humanError } from '@/lib/api/errors';
import { useI18n } from '@/lib/i18n';
import {
  completeMaintenanceOrder,
  createMaintenanceOrder,
  MaintenanceOrder,
  MaintenancePriority,
  startMaintenanceOrder,
} from '../api';

const statusTone = { open: 'neutral', in_progress: 'warning', completed: 'success', cancelled: 'danger' } as const;
const maintenanceTypeKey: Record<string, string> = { preventive: 'maintenance.type.preventive', corrective: 'maintenance.corrective' };

interface PanelProps {
  assetId?: string;
  assetName?: string;
  orders: MaintenanceOrder[];
  onChanged: () => void;
  compact?: boolean;
}

export function MaintenanceOrderPanel({ assetId, assetName, orders, onChanged, compact = false }: PanelProps) {
  const { t, locale } = useI18n();
  const can = useCan();
  const [createOpen, setCreateOpen] = useState(false);
  const [completing, setCompleting] = useState<MaintenanceOrder | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transition = async (order: MaintenanceOrder) => {
    setWorkingId(order.id); setError(null);
    try {
      await startMaintenanceOrder(order.id);
      onChanged();
    } catch (err) { setError(humanError(err, t('common.genericError'), locale)); }
    finally { setWorkingId(null); }
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {assetId && can(PERMISSIONS.MAINTENANCE_CREATE) && (
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> {t('maintenance.create')}</Button>
        )}
      </div>
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      {orders.length === 0 ? (
        <EmptyState title={t('maintenance.emptyTitle')} description={assetId ? t('maintenance.emptyAsset') : t('maintenance.emptyAll')} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-full divide-y divide-line text-sm">
            <thead className="bg-surface-muted text-start text-xs font-medium text-ink-muted">
              <tr>
                {!assetId && <th className="px-3 py-3">{t('maintenance.asset')}</th>}
                <th className="px-3 py-3">{t('maintenance.code')}</th>
                <th className="px-3 py-3">{t('maintenance.type')}</th>
                <th className="px-3 py-3">{t('maintenance.priority')}</th>
                <th className="px-3 py-3">{t('maintenance.status')}</th>
                <th className="px-3 py-3">{t('maintenance.dueDate')}</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line bg-surface">
              {orders.map((order) => (
                <tr key={order.id}>
                  {!assetId && <td className="px-3 py-3 text-ink"><div>{order.asset_name ?? '—'}</div><div className="text-xs text-ink-muted">{order.asset_code ?? ''}</div></td>}
                  <td className="px-3 py-3 font-mono text-xs text-ink">{order.maintenance_code ?? '—'}</td>
                  <td className="px-3 py-3 text-ink">{order.maintenance_type ? (maintenanceTypeKey[order.maintenance_type] ? t(maintenanceTypeKey[order.maintenance_type]) : order.maintenance_type) : t('maintenance.corrective')}</td>
                  <td className="px-3 py-3"><Badge tone={order.priority === 'critical' || order.priority === 'high' ? 'danger' : 'neutral'}>{t(`maintenance.priority.${order.priority ?? 'medium'}`)}</Badge></td>
                  <td className="px-3 py-3"><Badge tone={statusTone[order.workflow_status]}>{t(`maintenance.status.${order.workflow_status}`)}</Badge></td>
                  <td className="px-3 py-3 text-ink-muted">{formatDate(order.next_maintenance_date, locale)}</td>
                  <td className="px-3 py-3 text-end">
                    {can(PERMISSIONS.MAINTENANCE_MANAGE) && order.workflow_status === 'open' && (
                      <Button size="sm" variant="secondary" loading={workingId === order.id} onClick={() => transition(order)}><Play className="h-3.5 w-3.5" /> {t('maintenance.start')}</Button>
                    )}
                    {can(PERMISSIONS.MAINTENANCE_MANAGE) && order.workflow_status === 'in_progress' && (
                      <Button size="sm" variant="primary" loading={workingId === order.id} onClick={() => setCompleting(order)}>{t('maintenance.complete')}</Button>
                    )}
                    {order.workflow_status === 'completed' && order.cost !== null && <span className="text-xs text-ink-muted">{formatCurrency(order.cost, locale)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {assetId && createOpen && <CreateMaintenanceOrderModal assetId={assetId} assetName={assetName ?? ''} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); onChanged(); }} />}
      {completing && <CompleteMaintenanceOrderModal order={completing} onClose={() => setCompleting(null)} onCompleted={() => { setCompleting(null); onChanged(); }} />}
    </div>
  );
}

function CreateMaintenanceOrderModal({ assetId, assetName, onClose, onCreated }: { assetId: string; assetName: string; onClose: () => void; onCreated: () => void }) {
  const { t, locale } = useI18n();
  const [maintenanceType, setMaintenanceType] = useState('preventive');
  const [technician, setTechnician] = useState('');
  const [technicianContact, setTechnicianContact] = useState('');
  const [priority, setPriority] = useState<MaintenancePriority>('medium');
  const [nextDate, setNextDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      await createMaintenanceOrder(assetId, { maintenance_type: maintenanceType.trim() || undefined, technician_name: technician.trim() || undefined, technician_contact: technicianContact.trim() || undefined, priority, next_maintenance_date: nextDate || undefined });
      onCreated();
    } catch (err) { setError(humanError(err, t('common.genericError'), locale)); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('maintenance.createTitle').replace('{name}', assetName)} size="md">
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('maintenance.type')}>
          <select value={maintenanceType} onChange={(event) => setMaintenanceType(event.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
            <option value="preventive">{t('maintenance.type.preventive')}</option>
            <option value="corrective">{t('maintenance.corrective')}</option>
          </select>
        </Field>
        <Field label={t('maintenance.technician')}><Input value={technician} onChange={(event) => setTechnician(event.target.value)} /></Field>
        <Field label={t('maintenance.technicianContact')}><Input value={technicianContact} onChange={(event) => setTechnicianContact(event.target.value)} /></Field>
        <Field label={t('maintenance.priority')}>
          <select value={priority} onChange={(event) => setPriority(event.target.value as MaintenancePriority)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
            {(['low', 'medium', 'high', 'critical'] as const).map((value) => <option key={value} value={value}>{t(`maintenance.priority.${value}`)}</option>)}
          </select>
        </Field>
        <Field label={t('maintenance.dueDate')}><Input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" size="sm" loading={saving}>{t('maintenance.create')}</Button></div>
      </form>
    </Modal>
  );
}

function CompleteMaintenanceOrderModal({ order, onClose, onCompleted }: { order: MaintenanceOrder; onClose: () => void; onCompleted: () => void }) {
  const { t, locale } = useI18n();
  const [cost, setCost] = useState(order.cost?.toString() ?? '');
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [nextDate, setNextDate] = useState(order.next_maintenance_date?.slice(0, 10) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      await completeMaintenanceOrder(order.id, { end_date: endDate || undefined, cost: cost.trim() ? Number(cost) : undefined, next_maintenance_date: nextDate || undefined });
      onCompleted();
    } catch (err) { setError(humanError(err, t('common.genericError'), locale)); }
    finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('maintenance.completeTitle').replace('{code}', order.maintenance_code ?? '')} size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label={t('maintenance.endDate')}><Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field>
        <Field label={t('maintenance.cost')}><Input type="number" min="0" step="0.01" value={cost} onChange={(event) => setCost(event.target.value)} /></Field>
        <Field label={t('maintenance.dueDate')}><Input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></Field>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" size="sm" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" size="sm" loading={saving}>{t('maintenance.complete')}</Button></div>
      </form>
    </Modal>
  );
}
