'use client';

import type { PublicSession } from '@sakan/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/badge';
import { Countdown } from '@/components/countdown';
import { useI18n } from '@/components/i18n-provider';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatPrice } from '@/lib/i18n';
import { verifyDraw, type DrawCheck } from '@/lib/verify-draw';

/** How often the page refreshes progress while the session is live. */
const POLL_MS = 10_000;

export default function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const { locale, t } = useI18n();
  const [session, setSession] = useState<PublicSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSession(await api.session(id));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 404 ? t['session.notFound'] : t['sessions.apiDown']);
    }
  }, [id, t]);

  const live = session && !['COMPLETED', 'CANCELLED'].includes(session.status);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [live, load]);

  if (!session) return <div className="page">{error ? <p className="error">{error}</p> : <p className="muted">{t['common.loading']}</p>}</div>;
  const s = session;
  const pct = Math.min(100, (s.confirmedEntries / s.targetEntries) * 100);
  const remaining = Math.max(0, s.targetEntries - s.confirmedEntries);

  return (
    <div className="page">
      <p>
        <Link href="/#sessions" className="text-link">{t['common.back']}</Link>
      </p>
      <div className="card-head">
        <h1>{s.name}</h1>
        <Badge kind="session" status={s.status} />
      </div>
      {s.description && <p className="lead">{s.description}</p>}

      <div className="session-layout">
        <div className="card">
          <div className="progress big" role="progressbar" aria-valuenow={s.confirmedEntries} aria-valuemax={s.targetEntries}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <p className="progress-label">
            <strong>{t['sessions.entries'](s.confirmedEntries, s.targetEntries)}</strong>
            {s.status === 'OPEN' && remaining > 0 && <span className="muted"> · {t['sessions.remaining'](remaining)}</span>}
          </p>
          {live && <p className="muted small">● {t['session.live']}</p>}
          {s.status === 'SCHEDULED' && s.drawScheduledAt && (
            <div className="countdown-box">
              <span>{t['sessions.drawIn']}</span>
              <Countdown to={s.drawScheduledAt} onDone={() => setTimeout(() => void load(), 3000)} />
              <span className="muted small">{formatDateTime(s.drawScheduledAt, locale)}</span>
            </div>
          )}
          {s.status === 'CANCELLED' && <p className="notice">{t['session.cancelled']}</p>}

          <dl className="details">
            <dt>{t['session.price']}</dt>
            <dd>{formatPrice(s.entryPriceCents, s.currency, locale)}</dd>
            <dt>{t['session.target']}</dt>
            <dd>{s.targetEntries.toLocaleString()}</dd>
            <dt>{t['session.winners']}</dt>
            <dd>{s.winnerCount}</dd>
            <dt>{t['session.maxPerUser']}</dt>
            <dd>{s.maxEntriesPerUser ?? t['session.unlimited']}</dd>
            <dt>{t['session.rule']}</dt>
            <dd>
              {s.drawDelayMinutes
                ? t['session.rule.delay'](s.drawDelayMinutes)
                : t['session.rule.timeOfDay'](s.drawTimeOfDay, s.timezone)}
            </dd>
            {s.opensAt && (
              <>
                <dt>{t['session.opensAt']}</dt>
                <dd>{formatDateTime(s.opensAt, locale)}</dd>
              </>
            )}
            {s.closesAt && (
              <>
                <dt>{t['session.closesAt']}</dt>
                <dd>{formatDateTime(s.closesAt, locale)}</dd>
              </>
            )}
          </dl>
          {s.allowOverfill && <p className="muted small">{t['session.overfill']}</p>}
        </div>

        <BuyBox session={s} />
      </div>

      {s.draw && <DrawProof session={s} />}
    </div>
  );
}

function BuyBox({ session }: { session: PublicSession }) {
  const { user, token } = useAuth();
  const { locale, t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    api
      .participations(token)
      .then((p) => setMine(p.entries.filter((e) => e.session.id === session.id && e.status === 'ACTIVE').length))
      .catch(() => undefined);
  }, [token, session.id, session.confirmedEntries]);

  async function buy() {
    if (!token) return;
    setBusy(true);
    setError(null);
    // One key per tap: a retried request (double click, flaky network) can't buy twice.
    // crypto.randomUUID only exists on https and localhost; fall back elsewhere (e.g. a phone on the LAN).
    const key =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    try {
      const { payment, redirectUrl } = await api.checkout(token, session.id, key);
      if (redirectUrl && /^https?:\/\//.test(redirectUrl)) window.location.assign(redirectUrl);
      else router.push(`/payments/${payment.reference}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t['common.error']);
      setBusy(false);
    }
  }

  return (
    <aside className="card buy-box">
      <p className="price">{formatPrice(session.entryPriceCents, session.currency, locale)}</p>
      {mine !== null && mine > 0 && (
        <p>
          <Link href="/participations" className="text-link">{t['session.yourEntries'](mine)}</Link>
        </p>
      )}
      {!session.acceptingEntries ? (
        <p className="muted">{t['session.notAccepting']}</p>
      ) : user === undefined ? (
        <p className="muted">{t['common.loading']}</p>
      ) : !user ? (
        <Link href="/login" className="button">{t['session.signInToBuy']}</Link>
      ) : user.verificationStatus !== 'APPROVED' ? (
        <>
          <p className="muted">{t['session.verifyToBuy']}</p>
          <Link href="/profile" className="button secondary">{t['session.goVerify']}</Link>
        </>
      ) : (
        <button type="button" className="button" disabled={busy} onClick={buy}>
          {busy ? t['session.buyBusy'] : t['session.buy']}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </aside>
  );
}

function DrawProof({ session }: { session: PublicSession }) {
  const { locale, t } = useI18n();
  const draw = session.draw!;
  const [check, setCheck] = useState<DrawCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [entriesUrl, setEntriesUrl] = useState<string | null>(null);

  async function runCheck() {
    setBusy(true);
    setFailed(false);
    try {
      const list = await api.drawEntries(session.id);
      const result = await verifyDraw({
        seed: draw.seed!,
        seedHash: draw.seedHash,
        entriesHash: draw.entriesHash!,
        references: list.references,
        winnerCount: session.winnerCount,
      });
      setCheck(result);
      setEntriesUrl(URL.createObjectURL(new Blob([list.references.join('\n')], { type: 'text/plain' })));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const ok =
    check &&
    check.seedMatches &&
    check.entriesMatch &&
    check.winners.join() === draw.winners.map((w) => w.entryReference).join();

  return (
    <section className="card draw-proof">
      <h2>{t['session.drawTitle']}</h2>
      {draw.status === 'COMPLETED' && draw.winners.length > 0 && (
        <ul className="winners">
          {draw.winners.map((w) => (
            <li key={w.position}>
              <span className="muted">{session.winnerCount > 1 ? t['session.position'](w.position) : t['session.winner']}</span>
              <strong>{w.displayName}</strong>
              <code>{w.entryReference}</code>
            </li>
          ))}
        </ul>
      )}
      {draw.status === 'SCHEDULED' && <p className="muted">{t['session.drawPending']}</p>}
      <dl className="details hashes">
        <dt>{t['session.seedHash']}</dt>
        <dd>
          <code>{draw.seedHash}</code>
        </dd>
        <dt>{t['session.seed']}</dt>
        <dd>{draw.seed ? <code>{draw.seed}</code> : <span className="muted">{t['session.seedHidden']}</span>}</dd>
        {draw.entriesHash && (
          <>
            <dt>{t['session.entriesHash']}</dt>
            <dd>
              <code>{draw.entriesHash}</code>
            </dd>
            <dt>{t['session.entryCount']}</dt>
            <dd>{draw.entryCount}</dd>
          </>
        )}
        {draw.completedAt && (
          <>
            <dt>{t['session.drawnAt']}</dt>
            <dd>{formatDateTime(draw.completedAt, locale)}</dd>
          </>
        )}
      </dl>
      {draw.status === 'COMPLETED' && draw.seed && (
        <div className="actions inline">
          <button type="button" className="button secondary" disabled={busy} onClick={runCheck}>
            {busy ? t['session.verifyBusy'] : t['session.verify']}
          </button>
          {entriesUrl && (
            <a className="text-link" href={entriesUrl} download={`sakan-${session.number}-entries.txt`}>
              {t['session.downloadEntries']}
            </a>
          )}
        </div>
      )}
      {check && <p className={ok ? 'success' : 'error'}>{ok ? t['session.verifyOk'] : t['session.verifyFail']}</p>}
      {failed && <p className="error">{t['common.error']}</p>}
      <p className="muted small">{t['session.howVerified']}</p>
    </section>
  );
}
