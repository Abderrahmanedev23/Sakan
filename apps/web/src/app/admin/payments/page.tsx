'use client';

import { PaymentStatus, type AdminPayment } from '@sakan/shared';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { Badge } from '@/components/badge';
import { useI18n } from '@/components/i18n-provider';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatPrice } from '@/lib/i18n';

export default function AdminPaymentsPage() {
  const { t } = useI18n();
  return (
    <div className="page">
      <h1>{t['adminP.title']}</h1>
      <Suspense>
        <AdminOnly>{(token) => <PaymentList token={token} />}</AdminOnly>
      </Suspense>
    </div>
  );
}

function PaymentList({ token }: { token: string }) {
  const { locale, t } = useI18n();
  const sessionId = useSearchParams().get('sessionId') ?? undefined;
  const [status, setStatus] = useState<PaymentStatus | undefined>(undefined);
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminPayment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      setError(null);
      try {
        const page = await api.admin.payments(token, { status, sessionId, q, cursor });
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t['common.error']);
      } finally {
        setLoading(false);
      }
    },
    [token, status, sessionId, q, t],
  );
  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  async function refund(payment: AdminPayment) {
    const reason = window.prompt(t['adminP.refundPrompt']);
    if (!reason) return;
    try {
      const updated = await api.admin.refundPayment(token, payment.id, reason);
      setItems((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fieldErrors)[0] ?? err.message) : t['common.error']);
    }
  }

  return (
    <>
      <div className="tabs">
        <button type="button" className={!status ? 'tab active' : 'tab'} onClick={() => setStatus(undefined)}>
          {t['common.all']}
        </button>
        {Object.values(PaymentStatus).map((s) => (
          <button key={s} type="button" className={status === s ? 'tab active' : 'tab'} onClick={() => setStatus(s)}>
            {t[`payment.status.${s}`]}
          </button>
        ))}
      </div>
      <input className="search" type="search" placeholder={t['adminP.search']} value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="error">{error}</p>}
      {!loading && !error && items.length === 0 && <p className="muted">{t['adminP.none']}</p>}
      {items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t['adminP.col.reference']}</th>
                <th>{t['adminP.col.user']}</th>
                <th>{t['adminP.col.session']}</th>
                <th>{t['adminP.col.amount']}</th>
                <th>{t['adminP.col.status']}</th>
                <th>{t['adminP.col.date']}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <code>{p.reference}</code>
                    {p.entryReference && <div className="muted small">{p.entryReference}</div>}
                  </td>
                  <td><Link href={`/admin/users/${p.userId}`}>{p.userEmail}</Link></td>
                  <td><Link href={`/admin/sessions/${p.sessionId}`}>{p.sessionName}</Link></td>
                  <td>{formatPrice(p.amountCents, p.currency, locale)}</td>
                  <td>
                    <Badge kind="payment" status={p.status} />
                    {p.failureReason && p.status !== 'SUCCEEDED' && <div className="muted small">{p.failureReason}</div>}
                    {p.status === 'SUCCEEDED' && (
                      <div>
                        <button type="button" className="link small" onClick={() => refund(p)}>
                          {t['adminP.refund']}
                        </button>
                      </div>
                    )}
                  </td>
                  <td>{formatDateTime(p.createdAt, locale)}</td>
                </tr>
              ))}
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
