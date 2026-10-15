'use client';

import { SessionStatus, type AdminSession, type AdminStats } from '@sakan/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { Badge } from '@/components/badge';
import { useI18n } from '@/components/i18n-provider';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatPrice } from '@/lib/i18n';

export default function AdminSessionsPage() {
  const { t } = useI18n();
  return (
    <div className="page">
      <div className="card-head">
        <h1>{t['adminS.title']}</h1>
        <Link href="/admin/sessions/new" className="button">{t['adminS.new']}</Link>
      </div>
      <AdminOnly>{(token) => <Dashboard token={token} />}</AdminOnly>
    </div>
  );
}

const STAT_KEYS = [
  ['pendingVerifications', 'adminS.stats.pendingVerifications'],
  ['approvedUsers', 'adminS.stats.approvedUsers'],
  ['openSessions', 'adminS.stats.openSessions'],
  ['scheduledDraws', 'adminS.stats.scheduledDraws'],
  ['completedDraws', 'adminS.stats.completedDraws'],
  ['succeededPayments', 'adminS.stats.succeededPayments'],
] as const;

function Dashboard({ token }: { token: string }) {
  const { locale, t } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [sessions, setSessions] = useState<AdminSession[] | null>(null);
  const [status, setStatus] = useState<SessionStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin.stats(token).then(setStats).catch(() => undefined);
  }, [token]);
  useEffect(() => {
    setSessions(null);
    api.admin
      .sessions(token, status)
      .then(setSessions)
      .catch((err) => setError(err instanceof ApiError ? err.message : t['common.error']));
  }, [token, status, t]);

  return (
    <>
      {stats && (
        <div className="stats">
          {STAT_KEYS.map(([key, label]) => (
            <div key={key} className="stat">
              <strong>{stats[key].toLocaleString()}</strong>
              <span>{t[label]}</span>
            </div>
          ))}
          <div className="stat">
            <strong>{formatPrice(stats.revenueCents, 'MAD', locale)}</strong>
            <span>{t['adminS.stats.revenue']}</span>
          </div>
        </div>
      )}

      <div className="tabs">
        <button type="button" className={!status ? 'tab active' : 'tab'} onClick={() => setStatus(undefined)}>
          {t['common.all']}
        </button>
        {Object.values(SessionStatus).map((s) => (
          <button key={s} type="button" className={status === s ? 'tab active' : 'tab'} onClick={() => setStatus(s)}>
            {t[`session.status.${s}`]}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {!sessions && !error && <p className="muted">{t['common.loading']}</p>}
      {sessions?.length === 0 && <p className="muted">{t['adminS.none']}</p>}
      {sessions && sessions.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t['adminS.col.name']}</th>
                <th>{t['adminS.col.status']}</th>
                <th>{t['adminS.col.progress']}</th>
                <th>{t['adminS.col.price']}</th>
                <th>{t['adminS.col.draw']}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/admin/sessions/${s.id}`}>{s.name}</Link>
                    <div className="muted small">#{s.number}</div>
                  </td>
                  <td>
                    <Badge kind="session" status={s.status} />
                    {s.drawLastError && <div className="error small">⚠</div>}
                  </td>
                  <td>
                    {s.confirmedEntries.toLocaleString()} / {s.targetEntries.toLocaleString()}
                    <div className="progress"><div style={{ width: `${Math.min(100, (s.confirmedEntries / s.targetEntries) * 100)}%` }} /></div>
                  </td>
                  <td>{formatPrice(s.entryPriceCents, s.currency, locale)}</td>
                  <td>{s.drawScheduledAt ? formatDateTime(s.drawScheduledAt, locale) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
