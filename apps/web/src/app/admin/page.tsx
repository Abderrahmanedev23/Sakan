'use client';

import { VerificationStatus, type AdminUserSummary } from '@sakan/shared';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { StatusBadge } from '@/components/status-badge';
import { api, ApiError } from '@/lib/api';

const TABS: { label: string; status?: VerificationStatus }[] = [
  { label: 'Waiting for review', status: 'PENDING' },
  { label: 'Verified', status: 'APPROVED' },
  { label: 'Rejected', status: 'REJECTED' },
  { label: 'Not submitted', status: 'UNSUBMITTED' },
  { label: 'All users' },
];

export default function AdminPage() {
  return (
    <>
      <h1>Identity reviews</h1>
      <AdminOnly>{(token) => <UserList token={token} />}</AdminOnly>
    </>
  );
}

function UserList({ token }: { token: string }) {
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
        setError(err instanceof ApiError ? err.message : 'Could not load users');
      } finally {
        setLoading(false);
      }
    },
    [token, tab, q],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const pending = TABS[tab]?.status === 'PENDING';

  return (
    <>
      <div className="tabs">
        {TABS.map((t, i) => (
          <button key={t.label} type="button" className={i === tab ? 'tab active' : 'tab'} onClick={() => setTab(i)}>
            {t.label}
          </button>
        ))}
      </div>
      <input
        className="search"
        type="search"
        placeholder="Search by email, name or CIN"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="muted">{pending ? 'Nothing waiting for review.' : 'No users here.'}</p>
      )}
      {items.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>CIN</th>
              <th>Status</th>
              <th>{pending ? 'Submitted' : 'Signed up'}</th>
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
                <td>{new Date((pending && u.identitySubmittedAt) || u.createdAt).toLocaleString('fr-MA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {nextCursor && (
        <button type="button" className="button secondary" disabled={loading} onClick={() => void load(nextCursor)}>
          Load more
        </button>
      )}
    </>
  );
}
