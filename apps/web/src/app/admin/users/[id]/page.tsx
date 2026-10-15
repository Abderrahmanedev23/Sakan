'use client';

import type { AdminUserDetail, IdentityDocumentInfo } from '@sakan/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminOnly } from '@/components/admin-only';
import { StatusBadge } from '@/components/status-badge';
import { api, ApiError } from '@/lib/api';

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <p>
        <Link href="/admin">← Back to reviews</Link>
      </p>
      <AdminOnly>{(token) => <UserReview token={token} id={id} />}</AdminOnly>
    </>
  );
}

function UserReview({ token, id }: { token: string; id: string }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    api.admin
      .user(token, id)
      .then(setDetail)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this user'));
  }, [token, id]);

  async function act(action: () => Promise<AdminUserDetail>) {
    setBusy(true);
    setError(null);
    try {
      setDetail(await action());
      setRejectReason('');
      setSuspendReason('');
    } catch (err) {
      setError(
        err instanceof ApiError ? (Object.values(err.fieldErrors)[0] ?? err.message) : 'Something went wrong',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!detail) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
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
          <h2>CIN details</h2>
          <dl className="details">
            <dt>Email</dt>
            <dd>{user.email}</dd>
            <dt>Phone</dt>
            <dd>{user.phone ?? '—'}</dd>
            <dt>First name</dt>
            <dd>{user.firstName ?? '—'}</dd>
            <dt>Last name</dt>
            <dd>{user.lastName ?? '—'}</dd>
            <dt>Date of birth</dt>
            <dd>{user.dateOfBirth ?? '—'}</dd>
            <dt>CIN number</dt>
            <dd>{user.cinNumber ?? '—'}</dd>
            <dt>CIN expires</dt>
            <dd>{user.cinExpiresAt ?? '—'}</dd>
            <dt>Submitted</dt>
            <dd>{user.identitySubmittedAt ? new Date(user.identitySubmittedAt).toLocaleString('fr-MA') : '—'}</dd>
          </dl>
        </div>
        {user.documents.map((doc) => (
          <DocumentImage key={doc.id} token={token} doc={doc} />
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {user.verificationStatus === 'PENDING' && (
        <div className="card actions">
          <h2>Decision</h2>
          <p className="muted">Check that the photos match the details and the card is genuine and not expired.</p>
          <button type="button" className="button" disabled={busy} onClick={() => act(() => api.admin.approve(token, id))}>
            Approve
          </button>
          <textarea
            placeholder="Reason for rejection, shown to the user (e.g. back photo is blurry)"
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
            Reject
          </button>
        </div>
      )}

      {user.role !== 'ADMIN' && (
        <div className="card actions">
          <h2>Account</h2>
          {user.accountStatus === 'ACTIVE' ? (
            <>
              <textarea
                placeholder="Reason for suspension (kept in the audit log)"
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
                Suspend account
              </button>
            </>
          ) : (
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => act(() => api.admin.reactivate(token, id))}
            >
              Reactivate account
            </button>
          )}
        </div>
      )}

      <h2>Review history</h2>
      {reviews.length === 0 ? (
        <p className="muted">No decisions yet.</p>
      ) : (
        <ul className="log">
          {reviews.map((r) => (
            <li key={r.id}>
              <StatusBadge status={r.decision} /> by {r.reviewerEmail} on {new Date(r.createdAt).toLocaleString('fr-MA')}
              {r.reason && <div className="muted">{r.reason}</div>}
            </li>
          ))}
        </ul>
      )}

      <h2>Audit log</h2>
      <ul className="log">
        {auditLogs.map((log) => (
          <li key={log.id}>
            <code>{log.action}</code> by {log.actorEmail ?? 'system'} on {new Date(log.createdAt).toLocaleString('fr-MA')}
            {log.ipAddress && <span className="muted"> · {log.ipAddress}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

function DocumentImage({ token, doc }: { token: string; doc: IdentityDocumentInfo }) {
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
      <figcaption>{doc.side === 'FRONT' ? 'Front' : 'Back'}</figcaption>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={`CIN ${doc.side.toLowerCase()}`} />
        </a>
      ) : (
        <p className="muted">{failed ? 'Could not load the image.' : 'Loading…'}</p>
      )}
    </figure>
  );
}
