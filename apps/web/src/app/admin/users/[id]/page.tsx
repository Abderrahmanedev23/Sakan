'use client';

import type { AdminUserDetail, IdentityDocumentInfo } from '@sakan/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { useI18n } from '@/components/i18n-provider';
import { StatusBadge } from '@/components/status-badge';
import { api, ApiError } from '@/lib/api';
import { formatDateTime } from '@/lib/i18n';

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  return (
    <div className="page">
      <p>
        <Link href="/admin" className="text-link">{t['admin.back']}</Link>
      </p>
      <AdminOnly>{(token) => <UserReview token={token} id={id} />}</AdminOnly>
    </div>
  );
}

function UserReview({ token, id }: { token: string; id: string }) {
  const { locale, t } = useI18n();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    api.admin
      .user(token, id)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : t['admin.userLoadError']));
  }, [token, id, t]);

  async function act(action: () => Promise<AdminUserDetail>) {
    setBusy(true);
    setError(null);
    try {
      setDetail(await action());
      setRejectReason('');
      setSuspendReason('');
    } catch (err) {
      setError(
        err instanceof ApiError ? (Object.values(err.fieldErrors)[0] ?? err.message) : t['common.error'],
      );
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return error ? <p className="error">{error}</p> : <p className="muted">{t['common.loading']}</p>;
  const { user, reviews, auditLogs } = detail;

  return (
    <>
      <h1>
        {user.firstName || user.lastName ? `${user.firstName ?? ''} ${user.lastName ?? ''}` : user.email}
      </h1>
      <p>
        <StatusBadge status={user.verificationStatus} /> <StatusBadge status={user.accountStatus} />
      </p>

      <div className="grid">
        <div className="card">
          <h2>{t['admin.details']}</h2>
          <dl className="details">
            <dt>{t['common.email']}</dt>
            <dd>{user.email}</dd>
            <dt>{t['field.phone']}</dt>
            <dd>{user.phone ?? '—'}</dd>
            <dt>{t['field.firstName']}</dt>
            <dd>{user.firstName ?? '—'}</dd>
            <dt>{t['field.lastName']}</dt>
            <dd>{user.lastName ?? '—'}</dd>
            <dt>{t['field.dateOfBirth']}</dt>
            <dd>{user.dateOfBirth ?? '—'}</dd>
            <dt>{t['field.cinNumber']}</dt>
            <dd>{user.cinNumber ?? '—'}</dd>
            <dt>{t['field.cinExpires']}</dt>
            <dd>{user.cinExpiresAt ?? '—'}</dd>
            <dt>{t['field.submitted']}</dt>
            <dd>{user.identitySubmittedAt ? formatDateTime(user.identitySubmittedAt, locale) : '—'}</dd>
          </dl>
        </div>
        {user.documents.map((doc) => (
          <DocumentImage key={doc.id} token={token} doc={doc} />
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {user.verificationStatus === 'PENDING' && (
        <div className="card actions">
          <h2>{t['admin.decision']}</h2>
          <p className="muted">{t['admin.decisionHint']}</p>
          <button type="button" className="button" disabled={busy} onClick={() => act(() => api.admin.approve(token, id))}>
            {t['admin.approve']}
          </button>
          <textarea
            placeholder={t['admin.rejectPlaceholder']}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
          />
          <button
            type="button"
            className="button danger"
            disabled={busy}
            onClick={() => act(() => api.admin.reject(token, id, rejectReason))}
          >
            {t['admin.reject']}
          </button>
        </div>
      )}

      {user.role !== 'ADMIN' && (
        <div className="card actions">
          <h2>{t['admin.account']}</h2>
          {user.accountStatus === 'ACTIVE' ? (
            <>
              <textarea
                placeholder={t['admin.suspendPlaceholder']}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={2}
              />
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={() => act(() => api.admin.suspend(token, id, suspendReason))}
              >
                {t['admin.suspend']}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => act(() => api.admin.reactivate(token, id))}
            >
              {t['admin.reactivate']}
            </button>
          )}
        </div>
      )}

      <h2>{t['admin.reviews']}</h2>
      {reviews.length === 0 ? (
        <p className="muted">{t['admin.noReviews']}</p>
      ) : (
        <ul className="log">
          {reviews.map((r) => (
            <li key={r.id}>
              <StatusBadge status={r.decision} /> {t['admin.byOn'](r.reviewerEmail, formatDateTime(r.createdAt, locale))}
              {r.reason && <div className="muted">{r.reason}</div>}
            </li>
          ))}
        </ul>
      )}

      <h2>{t['admin.audit']}</h2>
      <ul className="log">
        {auditLogs.map((log) => (
          <li key={log.id}>
            <code>{log.action}</code> {t['admin.byOn'](log.actorEmail ?? t['admin.system'], formatDateTime(log.createdAt, locale))}
            {log.ipAddress && <span className="muted"> · {log.ipAddress}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

function DocumentImage({ token, doc }: { token: string; doc: IdentityDocumentInfo }) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    api.admin
      .document(token, doc.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setFailed(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, doc.id]);

  return (
    <figure className="card document">
      <figcaption>{doc.side === 'FRONT' ? t['admin.front'] : t['admin.back.side']}</figcaption>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={`CIN ${doc.side.toLowerCase()}`} />
        </a>
      ) : (
        <p className="muted">{failed ? t['admin.imageError'] : t['common.loading']}</p>
      )}
    </figure>
  );
}
