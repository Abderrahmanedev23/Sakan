'use client';

import type { MyParticipations } from '@sakan/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/badge';
import { useI18n } from '@/components/i18n-provider';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatPrice } from '@/lib/i18n';

export default function ParticipationsPage() {
  const { user, token } = useAuth();
  const { locale, t } = useI18n();
  const [data, setData] = useState<MyParticipations | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .participations(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : t['common.error']));
  }, [token, t]);

  if (user === undefined) return <p className="page muted">{t['common.loading']}</p>;
  if (!user) {
    return (
      <p className="page">
        <Link href="/login">{t['nav.signIn']}</Link> {t['my.signInPrompt']}
      </p>
    );
  }

  return (
    <div className="page">
      <h1>{t['my.title']}</h1>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">{t['common.loading']}</p>}
      {data && (
        <>
          <h2>{t['my.entries']}</h2>
          {data.entries.length === 0 ? (
            <p className="muted">
              {t['my.noEntries']} <Link href="/#sessions" className="text-link">{t['hero.secondary']}</Link>
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t['my.col.entry']}</th>
                    <th>{t['my.col.session']}</th>
                    <th>{t['my.col.status']}</th>
                    <th>{t['my.col.date']}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e) => (
                    <tr key={e.id} className={e.winningPosition ? 'winner-row' : undefined}>
                      <td>
                        <code>{e.reference}</code>
                        {e.winningPosition && <div className="success small">🏆 {t['my.won'](e.winningPosition)}</div>}
                      </td>
                      <td>
                        <Link href={`/sessions/${e.session.id}`}>{e.session.name}</Link>
                        <div><Badge kind="session" status={e.session.status} /></div>
                      </td>
                      <td><Badge kind="entry" status={e.status} /></td>
                      <td>{formatDateTime(e.createdAt, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>{t['my.payments']}</h2>
          {data.payments.length === 0 ? (
            <p className="muted">{t['my.noPayments']}</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t['my.col.reference']}</th>
                    <th>{t['my.col.session']}</th>
                    <th>{t['my.col.amount']}</th>
                    <th>{t['my.col.status']}</th>
                    <th>{t['my.col.date']}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payments.map((p) => (
                    <tr key={p.id}>
                      <td><Link href={`/payments/${p.reference}`}><code>{p.reference}</code></Link></td>
                      <td>{p.sessionName}</td>
                      <td>{formatPrice(p.amountCents, p.currency, locale)}</td>
                      <td>
                        <Badge kind="payment" status={p.status} />
                        {p.failureReason && p.status !== 'SUCCEEDED' && <div className="muted small">{p.failureReason}</div>}
                      </td>
                      <td>{formatDateTime(p.createdAt, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
