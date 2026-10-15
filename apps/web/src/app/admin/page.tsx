'use client';

import { VerificationStatus, type AdminUserSummary } from '@sakan/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { useI18n } from '@/components/i18n-provider';
import { StatusBadge } from '@/components/status-badge';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/i18n';

const TABS: { label: `admin.tab.${VerificationStatus | 'all'}`; status?: VerificationStatus }[] = [
  { label: 'admin.tab.PENDING', status: 'PENDING' },
  { label: 'admin.tab.APPROVED', status: 'APPROVED' },
  { label: 'admin.tab.REJECTED', status: 'REJECTED' },
  { label: 'admin.tab.UNSUBMITTED', status: 'UNSUBMITTED' },
  { label: 'admin.tab.all' },
];

export default function AdminPage() {
  const { t } = useI18n();
  return (
    <div className="page">
      <h1>{t['admin.title']}</h1>
      <AdminOnly>{(token) => <UserList token={token} />}</AdminOnly>
    </div>
  );
}

function UserList({ token }: { token: string }) {
  const { locale, t } = useI18n();
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminUserSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api.admin.listUsers(token, { verificationStatus: TABS[tab]?.status, q, cursor });
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t['admin.loadError']);
      } finally {
        setLoading(false);
      }
    },
    [token, tab, q, t],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const pending = TABS[tab]?.status === 'PENDING';

  return (
    <>
      <div className="tabs">
        {TABS.map((tab_, i) => (
          <button key={tab_.label} type="button" className={i === tab ? 'tab active' : 'tab'} onClick={() => setTab(i)}>
            {t[tab_.label]}
          </button>
        ))}
      </div>
      <input
        className="search"
        type="search"
        placeholder={t['admin.search']}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="muted">{pending ? t['admin.nothingPending'] : t['admin.noUsers']}</p>
      )}
      {items.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>{t['admin.col.user']}</th>
              <th>{t['field.cin']}</th>
              <th>{t['admin.col.status']}</th>
              <th>{pending ? t['admin.col.submitted'] : t['admin.col.signedUp']}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}`}>
                    {u.firstName || u.lastName ? `${u.firstName ?? ''} ${u.lastName ?? ''}` : u.email}
                  </Link>
                  <div className="muted small">{u.email}</div>
                </td>
                <td>{u.cinNumber ?? '—'}</td>
                <td>
                  <StatusBadge status={u.verificationStatus} />{' '}
                  {u.accountStatus !== 'ACTIVE' && <StatusBadge status={u.accountStatus} />}
                </td>
                <td>{formatDateTime((pending && u.identitySubmittedAt) || u.createdAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {nextCursor && (
        <button type="button" className="button secondary" disabled={loading} onClick={() => void load(nextCursor)}>
          {t['admin.loadMore']}
        </button>
      )}
    </>
  );
}
