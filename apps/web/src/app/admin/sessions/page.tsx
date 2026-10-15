'use client';

import { SessionStatus, type AdminSession, type AdminStats } from '@sakan/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { Badge } from '@/components/badge';
import { Countdown } from '@/components/countdown';
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

type StatKey = Exclude<keyof AdminStats, 'revenueCents'>;
const STATS: { key: StatKey; label: `adminS.stats.${StatKey}`; href?: string; status?: SessionStatus }[] = [
  { key: 'pendingVerifications', label: 'adminS.stats.pendingVerifications', href: '/admin' },
  { key: 'openSessions', label: 'adminS.stats.openSessions', status: 'OPEN' },
  { key: 'scheduledDraws', label: 'adminS.stats.scheduledDraws', status: 'SCHEDULED' },
  { key: 'completedDraws', label: 'adminS.stats.completedDraws', status: 'COMPLETED' },
];

function Dashboard({ token }: { token: string }) {
  const { locale, t } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [all, setAll] = useState<AdminSession[] | null>(null);
  const [status, setStatus] = useState<SessionStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin.stats(token).then(setStats).catch(() => undefined);
    api.admin
      .sessions(token)
      .then(setAll)
      .catch((err) => setError(err instanceof ApiError ? err.message : t['common.error']));
  }, [token, t]);

  const sessions = all && (status ? all.filter((s) => s.status === status) : all);
  const failedDraws = all?.filter((s) => s.drawLastError) ?? [];
  const upcoming = (all ?? [])
    .filter((s) => s.status === 'SCHEDULED' && s.drawScheduledAt)
    .sort((a, b) => a.drawScheduledAt!.localeCompare(b.drawScheduledAt!))
    .slice(0, 4);
  const showStatus = (s: SessionStatus) => {
    setStatus(s);
    document.getElementById('sessions')?.scrollIntoView();
  };

  return (
    <>
      {stats && (
        <div className="kpis">
          <div className="kpi kpi-primary">
            <span>{t['adminS.stats.revenue']}</span>
            <strong>{formatPrice(stats.revenueCents, 'MAD', locale)}</strong>
            <small>
              {stats.succeededPayments.toLocaleString()} {t['adminS.stats.succeededPayments']} ·{' '}
              {stats.approvedUsers.toLocaleString()} {t['adminS.stats.approvedUsers']}
            </small>
          </div>
          {STATS.map(({ key, label, href, status: target }) => {
            const body = (
              <>
                <span>{t[label]}</span>
                <strong>{stats[key].toLocaleString()}</strong>
              </>
            );
            return href ? (
              <Link key={key} href={href} className={key === 'pendingVerifications' && stats[key] > 0 ? 'kpi kpi-alert' : 'kpi'}>
                {body}
              </Link>
            ) : (
              <button key={key} type="button" className="kpi" onClick={() => showStatus(target!)}>
                {body}
              </button>
            );
          })}
        </div>
      )}

      <div className="dash-panels">
        <section className="card">
          <h2>{t['adminS.attention.title']}</h2>
          {stats && stats.pendingVerifications === 0 && failedDraws.length === 0 ? (
            <p className="muted">{t['adminS.attention.none']}</p>
          ) : (
            <ul className="todo">
              {stats && stats.pendingVerifications > 0 && (
                <li>
                  <span>{t['adminS.attention.pending']}: <strong>{stats.pendingVerifications}</strong></span>
                  <Link href="/admin" className="button small">{t['adminS.attention.review']}</Link>
                </li>
              )}
              {failedDraws.length > 0 && (
                <li>
                  <span>{t['adminS.attention.drawErrors']}: <strong>{failedDraws.length}</strong></span>
                  <Link href={`/admin/sessions/${failedDraws[0].id}`} className="button small danger">{t['adminS.attention.review']}</Link>
                </li>
              )}
            </ul>
          )}
        </section>
        <section className="card">
          <h2>{t['adminS.upcoming.title']}</h2>
          {upcoming.length === 0 ? (
            <p className="muted">{t['adminS.upcoming.none']}</p>
          ) : (
            <ul className="todo">
              {upcoming.map((s) => (
                <li key={s.id}>
                  <span>
                    <Link href={`/admin/sessions/${s.id}`}>{s.name}</Link>
                    <span className="muted small"> · {formatDateTime(s.drawScheduledAt!, locale)}</span>
                  </span>
                  <Countdown to={s.drawScheduledAt!} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <h2 id="sessions">{t['adminS.sessions']}</h2>
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
