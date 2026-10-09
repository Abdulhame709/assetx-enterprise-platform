'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Edit3, RefreshCw, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { PageHeader } from '@/components/ui/PageHeader';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { humanError } from '@/lib/api/errors';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { useSession } from '@/lib/auth/session-context';
import { useI18n } from '@/lib/i18n';
import {
  AdminRole,
  AdminUser,
  listAdminRoles,
  listAdminUsers,
  replaceAdminUserRoles,
  updateAdminUserStatus,
} from '@/features/admin/api';

export default function AdministrationPage() {
  const { session, can } = useSession();
  const { t, locale } = useI18n();
  const { confirm } = useConfirm();
  const toast = useToast();
  const canManageUsers = can(PERMISSIONS.ADMIN_USER);
  const canManageRoles = can(PERMISSIONS.ADMIN_ROLE);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [draftRoleIds, setDraftRoleIds] = useState<string[]>([]);
  const [savingRolesFor, setSavingRolesFor] = useState<string | null>(null);
  const [updatingStatusFor, setUpdatingStatusFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canManageUsers && !canManageRoles) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextUsers, nextRoles] = await Promise.all([
        canManageUsers ? listAdminUsers() : Promise.resolve([]),
        canManageRoles ? listAdminRoles() : Promise.resolve([]),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
    } catch (err) {
      setError(humanError(err, t('common.genericError'), locale));
    } finally {
      setLoading(false);
    }
  }, [canManageRoles, canManageUsers, locale, t]);

  useEffect(() => { void load(); }, [load]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => user.username.toLowerCase().includes(needle) || (user.email ?? '').toLowerCase().includes(needle) || user.roles.some((role) => role.name.toLowerCase().includes(needle)));
  }, [query, users]);

  const activeUsers = users.filter((user) => user.is_active).length;
  const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', { dateStyle: 'medium' }).format(new Date(value)) : '—';

  const beginRoleEdit = (user: AdminUser) => {
    setEditingUserId(user.id);
    setDraftRoleIds(user.roles.map((role) => role.id));
  };

  const toggleDraftRole = (roleId: string) => {
    setDraftRoleIds((current) => current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]);
  };

  const saveRoles = async (user: AdminUser) => {
    setSavingRolesFor(user.id);
    try {
      const nextUsers = await replaceAdminUserRoles(user.id, draftRoleIds);
      setUsers(nextUsers);
      setEditingUserId(null);
      toast.success(t('module.adminRolesSaved'), user.username);
    } catch (err) {
      toast.error(t('module.adminRolesSaveFailed'), humanError(err, t('common.genericError'), locale));
    } finally {
      setSavingRolesFor(null);
    }
  };

  const toggleUserStatus = async (user: AdminUser) => {
    const nextStatus = !user.is_active;
    const approved = await confirm({
      title: nextStatus ? t('module.adminActivateTitle') : t('module.adminDeactivateTitle'),
      message: nextStatus ? t('module.adminActivateMessage') : t('module.adminDeactivateMessage'),
      confirmLabel: nextStatus ? t('module.adminActivate') : t('module.adminDeactivate'),
      tone: nextStatus ? 'default' : 'danger',
    });
    if (!approved) return;
    setUpdatingStatusFor(user.id);
    try {
      const updated = await updateAdminUserStatus(user.id, nextStatus);
      setUsers((current) => current.map((item) => item.id === updated.id ? { ...item, is_active: updated.is_active } : item));
      toast.success(nextStatus ? t('module.adminActivated') : t('module.adminDeactivated'), user.username);
    } catch (err) {
      toast.error(t('module.adminStatusFailed'), humanError(err, t('common.genericError'), locale));
    } finally {
      setUpdatingStatusFor(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('nav.administrationPage')}
        subtitle={t('module.adminSubtitle')}
        actions={<Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}><RefreshCw className="h-4 w-4" aria-hidden="true" />{t('common.refresh')}</Button>}
      />

      {!session || (!canManageUsers && !canManageRoles) ? (
        <EmptyState title={t('module.adminNoAccess')} description={t('module.adminNoAccessDesc')} />
      ) : loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SummaryCard icon={Users} label={t('module.adminUsersCount')} value={users.length.toLocaleString(locale)} />
            <SummaryCard icon={UserRound} label={t('module.adminActiveUsers')} value={activeUsers.toLocaleString(locale)} />
            <SummaryCard icon={ShieldCheck} label={t('module.adminRolesCount')} value={roles.length.toLocaleString(locale)} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
            {canManageUsers && (
              <Card>
                <CardHeader title={t('module.adminUsersTitle')} subtitle={t('module.adminUsersSubtitle')} />
                <CardBody>
                  <input className="ax-input w-full" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('module.adminSearchUsers')} aria-label={t('module.adminSearchUsers')} />
                  {filteredUsers.length === 0 ? <EmptyState title={t('module.adminNoUsers')} description={t('module.adminNoUsersDesc')} /> : (
                    <div className="divide-y divide-line" aria-live="polite">
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="space-y-3 py-3 first:pt-0 last:pb-0">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="font-semibold text-ink">{user.username}</p>
                              <p className="text-xs text-ink-muted">{user.email ?? t('module.adminNoEmail')} · {t('module.adminLastLogin')}: {formatDate(user.last_login)}</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {user.roles.length ? user.roles.map((role) => <span key={role.id} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">{role.name}</span>) : <span className="text-xs text-ink-faint">{t('module.adminNoRoles')}</span>}
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              {canManageRoles && <Button variant="ghost" size="sm" onClick={() => editingUserId === user.id ? setEditingUserId(null) : beginRoleEdit(user)}><Edit3 className="h-3.5 w-3.5" aria-hidden="true" />{editingUserId === user.id ? t('common.cancel') : t('module.adminEditRoles')}</Button>}
                              <Button variant={user.is_active ? 'secondary' : 'primary'} size="sm" loading={updatingStatusFor === user.id} onClick={() => void toggleUserStatus(user)}>{user.is_active ? t('module.adminDeactivate') : t('module.adminActivate')}</Button>
                            </div>
                          </div>
                          {editingUserId === user.id && canManageRoles && (
                            <div className="rounded-xl border border-brand/20 bg-brand-soft/25 p-3">
                              <p className="mb-2 text-xs font-semibold text-ink">{t('module.adminChooseRoles')}</p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {roles.map((role) => (
                                  <label key={role.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm text-ink hover:bg-surface-muted">
                                    <input type="checkbox" checked={draftRoleIds.includes(role.id)} onChange={() => toggleDraftRole(role.id)} className="h-4 w-4 accent-brand" />
                                    <span>{role.name}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="mt-3 flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setEditingUserId(null)}><X className="h-3.5 w-3.5" aria-hidden="true" />{t('common.cancel')}</Button>
                                <Button variant="primary" size="sm" loading={savingRolesFor === user.id} onClick={() => void saveRoles(user)}><Check className="h-3.5 w-3.5" aria-hidden="true" />{t('common.save')}</Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            {canManageRoles && (
              <Card>
                <CardHeader title={t('module.adminRolesTitle')} subtitle={t('module.adminRolesSubtitle')} />
                <CardBody>
                  {roles.length === 0 ? <EmptyState title={t('module.adminNoRoles')} description={t('module.adminNoRolesDesc')} /> : (
                    <div className="space-y-2">
                      {roles.map((role) => (
                        <div key={role.id} className="rounded-xl border border-line bg-surface-muted/35 p-3">
                          <p className="font-medium text-ink">{role.name}</p>
                          {role.description && <p className="mt-1 text-xs text-ink-muted">{role.description}</p>}
                          {role.role_type && <p className="mt-2 text-[11px] text-ink-faint">{role.role_type}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="h-5 w-5" aria-hidden="true" /></span>
      <div><p className="text-xs text-ink-muted">{label}</p><p className="text-xl font-semibold text-ink">{value}</p></div>
    </Card>
  );
}
