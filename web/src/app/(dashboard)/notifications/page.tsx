'use client';

import { useAsync } from '@/lib/use-async';
import { useI18n, formatDateTime } from '@/lib/i18n';
import { http } from '@/lib/api/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';

type NotificationItem = {
  id: string;
  payload: Record<string, unknown>;
  created_at: string | null;
  read_at: string | null;
};

type NotificationResponse = { items: NotificationItem[]; unread: number };

function asItems(raw: unknown): NotificationItem[] {
  const source = Array.isArray(raw)
    ? raw
    : ((raw as { items?: unknown[]; data?: unknown[] } | null)?.items
      ?? (raw as { items?: unknown[]; data?: unknown[] } | null)?.data
      ?? []);
  if (!Array.isArray(source)) return [];
  return source.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    return {
      id: String(row.id ?? ''),
      payload: (row.payload && typeof row.payload === 'object' ? row.payload : {}) as Record<string, unknown>,
      created_at: row.created_at ? String(row.created_at) : null,
      read_at: row.read_at ? String(row.read_at) : null,
    };
  }).filter((item) => item.id);
}

async function loadNotifications(): Promise<NotificationResponse> {
  const [raw, unreadRaw] = await Promise.all([
    http.get<unknown>('/notifications'),
    http.get<{ unread?: number }>('/notifications/unread-count'),
  ]);
  return { items: asItems(raw), unread: Number(unreadRaw?.unread ?? 0) };
}

export default function NotificationsPage() {
  const { t, locale } = useI18n();
  const { data, status, error, reload } = useAsync<NotificationResponse>(loadNotifications, [], {
    isEmpty: (response) => response.items.length === 0,
  });

  const markRead = async (id: string) => {
    await http.patch(`/notifications/${id}/read`);
    reload();
  };

  return (
    <div>
      <PageHeader
        title={t('nav.notifications')}
        subtitle={data ? `${data.unread} ${t('common.unreadNotifications')}` : t('placeholder.notificationSubtitle')}
      />
      <Card>
        <CardBody>
          {status === 'loading' && <p className="py-8 text-center text-sm text-ink-muted">{t('common.loading')}</p>}
          {status === 'error' && (
            <div className="py-8 text-center">
              <p className="text-sm text-danger">{error ?? t('common.noData')}</p>
              <button className="mt-3 rounded-lg border border-line px-3 py-2 text-sm" onClick={reload}>{t('common.refresh')}</button>
            </div>
          )}
          {status === 'empty' && <EmptyState title={t('nav.notifications')} description={t('common.noData')} />}
          {status === 'success' && data && (
            <div className="space-y-2">
              {data.items.map((item) => {
                const title = String(item.payload.title ?? item.payload.subject ?? t('common.notifications'));
                const body = String(item.payload.body ?? item.payload.message ?? '');
                return (
                  <article key={item.id} className={`rounded-lg border p-3 ${item.read_at ? 'border-line bg-surface' : 'border-brand/30 bg-brand-soft/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-medium text-ink">{title}</h2>
                        {body && <p className="mt-1 text-sm text-ink-muted">{body}</p>}
                        <p className="mt-2 text-xs text-ink-faint">{formatDateTime(item.created_at, locale)}</p>
                      </div>
                      {!item.read_at && (
                        <button className="shrink-0 rounded-lg border border-line px-2 py-1 text-xs text-ink-muted hover:bg-surface-muted" onClick={() => markRead(item.id)}>
                          {t('common.close')}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
