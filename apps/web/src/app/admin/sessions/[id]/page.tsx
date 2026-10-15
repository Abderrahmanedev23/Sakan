'use client';

import type { AdminEntry, AdminSession } from '@sakan/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { Badge } from '@/components/badge';
import { Countdown } from '@/components/countdown';
import { useI18n } from '@/components/i18n-provider';
import { SessionForm } from '@/components/session-form';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatPrice } from '@/lib/i18n';

export default function AdminSessionPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  return (
    <div className="page">
      <p>
        <Link href="/admin/sessions" className="text-link">{t['common.back']}</Link>
      </p>
      <AdminOnly>{(token) => <SessionAdmin token={token} id={id} />}</AdminOnly>
    </div>
  );
}

function SessionAdmin({ token, id }: { token: string; id: string }) {
  const { locale, t } = useI18n();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    api.admin
      .session(token, id)
      .then(setSession)
      .catch((err) => setError(err instanceof ApiError ? err.message : t['common.error']));
  }, [token, id, t]);
  useEffect(load, [load]);

  async function act(action: () => Promise<AdminSession>, confirmFirst = false) {
    if (confirmFirst && !window.confirm(t['common.confirm'])) return;
    setBusy(true);
    setError(null);
    try {
      setSession(await action());
      setCancelReason('');
    } catch (err) {
      setError(err instanceof ApiError ? (Object.values(err.fieldErrors)[0] ?? err.message) : t['common.error']);
    } finally {
      setBusy(false);
    }
  }

  if (!session) return error ? <p className="error">{error}</p> : <p className="muted">{t['common.loading']}</p>;
  const s = session;
  const can = (status: AdminSession['status'][]) => status.includes(s.status);

  return (
    <>
      <div className="card-head">
        <h1>
          {s.name} <span className="muted small">#{s.number}</span>
        </h1>
        <Badge kind="session" status={s.status} />
      </div>
      {s.description && <p className="lead">{s.description}</p>}

      <div className="stats">
        <div className="stat">
          <strong>
            {s.confirmedEntries.toLocaleString()} / {s.targetEntries.toLocaleString()}
          </strong>
          <span>{t['adminS.col.progress']}</span>
        </div>
        <div className="stat">
          <strong>{formatPrice(s.entryPriceCents, s.currency, locale)}</strong>
          <span>{t['adminS.col.price']}</span>
        </div>
        <div className="stat">
          <strong>{formatPrice(s.revenueCents, s.currency, locale)}</strong>
          <span>{t['adminS.revenue']}</span>
        </div>
        <div className="stat">
          <strong>{s.pendingPayments}</strong>
          <span>{t['adminS.pending']}</span>
        </div>
      </div>

      <div className="session-layout">
        <div className="card">
          <dl className="details">
            <dt>{t['session.winners']}</dt>
            <dd>{s.winnerCount}</dd>
            <dt>{t['session.maxPerUser']}</dt>
            <dd>{s.maxEntriesPerUser ?? t['session.unlimited']}</dd>
            <dt>{t['session.rule']}</dt>
            <dd>{s.drawDelayMinutes ? t['session.rule.delay'](s.drawDelayMinutes) : t['session.rule.timeOfDay'](s.drawTimeOfDay, s.timezone)}</dd>
            {s.allowOverfill && (
              <>
                <dt />
                <dd>{t['session.overfill']}</dd>
              </>
            )}
            <dt>{t['session.opensAt']}</dt>
            <dd>{s.opensAt ? formatDateTime(s.opensAt, locale) : '—'}</dd>
            <dt>{t['session.closesAt']}</dt>
            <dd>{s.closesAt ? formatDateTime(s.closesAt, locale) : '—'}</dd>
            <dt>{t['adminS.createdBy']}</dt>
            <dd>{s.createdByEmail}</dd>
          </dl>
          <p className="actions inline">
            {s.status !== 'DRAFT' && <Link href={`/sessions/${s.id}`} className="text-link">{t['adminS.publicPage']}</Link>}
            <Link href={`/admin/payments?sessionId=${s.id}`} className="text-link">{t['adminS.payments']}</Link>
            {can(['DRAFT', 'OPEN', 'PAUSED', 'FULL', 'SCHEDULED']) && (
              <button type="button" className="link" onClick={() => setEditing((v) => !v)}>
                {t['adminS.form.editTitle']}
              </button>
            )}
          </p>
        </div>

        <aside className="card actions">
          <h2>{t['adminS.actions']}</h2>
          {s.draw && (
            <p>
              <Badge kind="draw" status={s.draw.status} /> {formatDateTime(s.draw.scheduledAt, locale)}
              {s.draw.status === 'SCHEDULED' && (
                <>
                  {' · '}
                  <Countdown to={s.draw.scheduledAt} />
                </>
              )}
            </p>
          )}
          {s.drawLastError && (
            <p className="notice">
              {t['adminS.drawError']} {s.drawLastError}
            </p>
          )}
          {s.status === 'DRAFT' && (
            <button type="button" className="button" disabled={busy} onClick={() => act(() => api.admin.sessionAction(token, id, 'open'), true)}>
              {t['adminS.open']}
            </button>
          )}
          {s.status === 'OPEN' && (
            <button type="button" className="button secondary" disabled={busy} onClick={() => act(() => api.admin.sessionAction(token, id, 'pause'))}>
              {t['adminS.pause']}
            </button>
          )}
          {s.status === 'PAUSED' && (
            <button type="button" className="button" disabled={busy} onClick={() => act(() => api.admin.sessionAction(token, id, 'resume'))}>
              {t['adminS.resume']}
            </button>
          )}
          {can(['OPEN', 'PAUSED']) && (
            <>
              <button type="button" className="button secondary" disabled={busy} onClick={() => act(() => api.admin.sessionAction(token, id, 'close'), true)}>
                {t['adminS.close']}
              </button>
              <small className="muted">{t['adminS.closeHint']}</small>
            </>
          )}
          {s.draw?.status === 'SCHEDULED' && new Date(s.draw.scheduledAt) < new Date() && (
            <button type="button" className="button" disabled={busy} onClick={() => act(() => api.admin.sessionAction(token, id, 'draw/retry'), true)}>
              {t['adminS.retryDraw']}
            </button>
          )}
          {can(['DRAFT', 'OPEN', 'PAUSED', 'FULL', 'SCHEDULED']) && (
            <>
              <textarea placeholder={t['adminS.cancelPlaceholder']} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} />
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={() => act(() => api.admin.cancelSession(token, id, cancelReason), true)}
              >
                {t['adminS.cancel']}
              </button>
            </>
          )}
          {error && <p className="error">{error}</p>}
        </aside>
      </div>

      {editing && (
        <SessionForm
          session={s}
          submitLabel={t['common.save']}
          onSubmit={async (input) => {
            setSession(await api.admin.updateSession(token, id, input));
            setEditing(false);
          }}
        />
      )}

      {s.draw && (
        <section className="card">
          <h2>{t['session.drawTitle']}</h2>
          <dl className="details hashes">
            <dt>{t['session.seedHash']}</dt>
            <dd><code>{s.draw.seedHash}</code></dd>
            {s.draw.seed && (
              <>
                <dt>{t['session.seed']}</dt>
                <dd><code>{s.draw.seed}</code></dd>
              </>
            )}
            {s.draw.entriesHash && (
              <>
                <dt>{t['session.entriesHash']}</dt>
                <dd><code>{s.draw.entriesHash}</code></dd>
              </>
            )}
            {s.draw.winners.map((w) => (
              <Winner key={w.position} label={s.winnerCount > 1 ? t['session.position'](w.position) : t['session.winner']} name={w.displayName} reference={w.entryReference} />
            ))}
          </dl>
        </section>
      )}

      <EntryList token={token} sessionId={id} refreshKey={s.confirmedEntries} />
    </>
  );
}

function Winner({ label, name, reference }: { label: string; name: string; reference: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>
        <strong>{name}</strong> · <code>{reference}</code>
      </dd>
    </>
  );
}

function EntryList({ token, sessionId, refreshKey }: { token: string; sessionId: string; refreshKey: number }) {
  const { locale, t } = useI18n();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<AdminEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (cursor?: string) => {
      setLoading(true);
      try {
        const page = await api.admin.sessionEntries(token, sessionId, { q, cursor });
        setItems((prev) => (cursor ? [...prev, ...page.items] : page.items));
        setNextCursor(page.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [token, sessionId, q],
  );
  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q, refreshKey]);

  return (
    <section>
      <h2>{t['adminS.entries']}</h2>
      <input className="search" type="search" placeholder={t['adminS.searchEntries']} value={q} onChange={(e) => setQ(e.target.value)} />
      {!loading && items.length === 0 && <p className="muted">{t['adminS.noEntries']}</p>}
      {items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t['adminS.col.entry']}</th>
                <th>{t['adminS.col.participant']}</th>
                <th>{t['adminS.col.payment']}</th>
                <th>{t['my.col.date']}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td>
                    <code>{e.reference}</code> <Badge kind="entry" status={e.status} />
                  </td>
                  <td>
                    <Link href={`/admin/users/${e.userId}`}>{e.userName ?? e.userEmail}</Link>
                    <div className="muted small">{e.userEmail}</div>
                  </td>
                  <td><code>{e.paymentReference}</code></td>
                  <td>{formatDateTime(e.createdAt, locale)}</td>
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
    </section>
  );
}
