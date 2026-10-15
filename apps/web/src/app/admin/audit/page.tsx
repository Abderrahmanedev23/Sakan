'use client';

import type { AuditLogEntry } from '@sakan/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { useI18n } from '@/components/i18n-provider';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/i18n';

const FILTERS = [
  { label: 'adminA.filter.all' },
  { label: 'adminA.filter.DrawSession', entityType: 'DrawSession' },
  { label: 'adminA.filter.Payment', entityType: 'Payment' },
  { label: 'adminA.filter.User', entityType: 'User' },
] as const;

export default function AdminAuditPage() {
  const { t } = useI18n();
  return (
    <div className="page">
      <h1>{t['adminA.title']}</h1>
      <AdminOnly>{(token) => <AuditList token={token} />}</AdminOnly>
    </div>
  );
}

function entityLink(log: AuditLogEntry): string | null {
  if (!log.entityId) return null;
  if (log.entityType === 'DrawSession') return `/admin/sessions/${log.entityId}`;
  if (log.entityType === 'User') return `/admin/users/${log.entityId}`;
  return null;
}

function AuditList({ token }: { token: string }) {
  const { locale, t } = useI18n();
  const [filter, setFilter] = useState(0);
  const [action, setAction] = useState('');
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const entityType = 'entityType' in FILTERS[filter] ? (FILTERS[filter] as { entityType: string }).entityType : undefined;
        const page = await api.admin.auditLogs(token, { entityType, action: action.trim() || undefined, cursor });
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t['common.error']);
      } finally {
        setLoading(false);
      }
    },
    [token, filter, action, t],
  );
  useEffect(() => {
    const timer = setTimeout(() => void load(), action ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, action]);

  return (
    <>
      <div className="tabs">
        {FILTERS.map((f, i) => (
          <button key={f.label} type="button" className={i === filter ? 'tab active' : 'tab'} onClick={() => setFilter(i)}>
            {t[f.label]}
          </button>
        ))}
      </div>
      <input className="search" type="search" placeholder="payment. / session.cancelled / draw." dir="ltr" value={action} onChange={(e) => setAction(e.target.value)} />
      {error && <p className="error">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="muted">{t['adminA.none']}</p>}
      {items.length > 0 && (
        <div className="table-wrap">
          <table className="table audit">
            <thead>
              <tr>
                <th>{t['adminA.col.when']}</th>
                <th>{t['adminA.col.action']}</th>
                <th>{t['adminA.col.actor']}</th>
                <th>{t['adminA.col.details']}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => {
                const href = entityLink(log);
                return (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt, locale)}</td>
                    <td>
                      <code>{log.action}</code>
                      <div className="muted small">
                        {href ? <Link href={href}>{log.entityType}</Link> : log.entityType}
                      </div>
                    </td>
                    <td>
                      {log.actorEmail ?? t['admin.system']}
                      {log.ipAddress && <div className="muted small">{log.ipAddress}</div>}
                    </td>
                    <td>{log.metadata ? <code className="metadata">{JSON.stringify(log.metadata)}</code> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {nextCursor && (
        <button type="button" className="button secondary" disabled={loading} onClick={() => void load(nextCursor)}>
          {t['common.loadMore']}
        </button>
      )}
    </>
  );
}
