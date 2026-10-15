'use client';

import type { PaymentInfo } from '@sakan/shared';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/badge';
import { useI18n } from '@/components/i18n-provider';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatPrice } from '@/lib/i18n';

/** Where the payment provider sends the user back. With the stub provider it also simulates the payment. */
export default function PaymentPage() {
  return (
    <Suspense>
      <PaymentView />
    </Suspense>
  );
}

function PaymentView() {
  const { reference } = useParams<{ reference: string }>();
  const stub = useSearchParams().get('stub') === '1';
  const { user, token } = useAuth();
  const { locale, t } = useI18n();
  const [payment, setPayment] = useState<PaymentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setPayment(await api.payment(token, reference));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t['common.error']);
    }
  }, [token, reference, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // A real provider confirms by webhook, possibly a moment after the user is back: keep checking.
  useEffect(() => {
    if (payment?.status !== 'PENDING' || stub) return;
    const timer = setInterval(() => void load(), 3000);
    return () => clearInterval(timer);
  }, [payment?.status, stub, load]);

  async function complete(succeeded: boolean) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      setPayment(await api.completeStubPayment(token, reference, succeeded));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t['common.error']);
    } finally {
      setBusy(false);
    }
  }

  if (user === undefined) return <p className="page muted">{t['common.loading']}</p>;
  if (!user) {
    return (
      <p className="page">
        <Link href="/login">{t['nav.signIn']}</Link> {t['my.signInPrompt']}
      </p>
    );
  }
  if (!payment) return <div className="page">{error ? <p className="error">{error}</p> : <p className="muted">{t['common.loading']}</p>}</div>;

  return (
    <section className="page narrow">
      <h1>{t['payment.title']}</h1>
      <div className="card">
        <p className={payment.status === 'SUCCEEDED' ? 'success' : payment.status === 'PENDING' ? '' : 'error'}>
          <strong>{t[`payment.done.${payment.status}`]}</strong>
        </p>
        <dl className="details">
          <dt>{t['payment.reference']}</dt>
          <dd><code>{payment.reference}</code></dd>
          <dt>{t['payment.session']}</dt>
          <dd><Link href={`/sessions/${payment.sessionId}`}>{payment.sessionName}</Link></dd>
          <dt>{t['payment.amount']}</dt>
          <dd>{formatPrice(payment.amountCents, payment.currency, locale)}</dd>
          <dt>{t['payment.status']}</dt>
          <dd><Badge kind="payment" status={payment.status} /></dd>
          {payment.entryReference && (
            <>
              <dt>{t['payment.entry']}</dt>
              <dd><code className="big-code">{payment.entryReference}</code></dd>
            </>
          )}
        </dl>
        {payment.failureReason && payment.status !== 'SUCCEEDED' && (
          <p className="muted">{t['payment.reason']} {payment.failureReason}</p>
        )}
        {payment.status === 'PENDING' && payment.expiresAt && (
          <p className="muted small">{t['payment.expires'](formatDateTime(payment.expiresAt, locale))}</p>
        )}
      </div>

      {payment.status === 'PENDING' && payment.provider === 'stub' && (
        <div className="card stub-box">
          <h2>{t['payment.stubTitle']}</h2>
          <p className="muted">{t['payment.stubBody']}</p>
          <div className="actions inline">
            <button type="button" className="button" disabled={busy} onClick={() => complete(true)}>
              {t['payment.stubPay']}
            </button>
            <button type="button" className="button danger" disabled={busy} onClick={() => complete(false)}>
              {t['payment.stubDecline']}
            </button>
          </div>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      <p className="actions inline">
        <Link href={`/sessions/${payment.sessionId}`} className="button secondary">{t['payment.backToSession']}</Link>
        <Link href="/participations" className="text-link">{t['nav.participations']}</Link>
      </p>
    </section>
  );
}
