'use client';

import { IDENTITY_DOCUMENT_MIME_TYPES, type UserProfile } from '@sakan/shared';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { StatusBadge } from '@/components/status-badge';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const STATUS_TEXT: Record<UserProfile['verificationStatus'], string> = {
  UNSUBMITTED: 'Add your CIN details and photos of both sides so we can verify your identity.',
  PENDING: 'Thanks. An admin is reviewing your CIN. You will be able to join sessions once it is approved.',
  APPROVED: 'Your identity is verified. You can join draw sessions.',
  REJECTED: 'Your CIN could not be verified. Fix the issue below and submit again.',
};

export default function ProfilePage() {
  const { user, token } = useAuth();

  if (user === undefined) return <p className="muted">Loading…</p>;
  if (!user || !token) {
    return (
      <p>
        <Link href="/login">Sign in</Link> to see your account.
      </p>
    );
  }

  const canSubmit = user.verificationStatus === 'UNSUBMITTED' || user.verificationStatus === 'REJECTED';

  return (
    <section className="narrow">
      <h1>My account</h1>
      <div className="card">
        <p>
          <strong>{user.email}</strong>
          {user.phone && <span className="muted"> · {user.phone}</span>}
        </p>
        <p>
          Identity: <StatusBadge status={user.verificationStatus} />
          {user.accountStatus !== 'ACTIVE' && (
            <>
              {' '}
              Account: <StatusBadge status={user.accountStatus} />
            </>
          )}
        </p>
        <p className="muted">{STATUS_TEXT[user.verificationStatus]}</p>
        {user.rejectionReason && (
          <p className="notice">
            <strong>Reason:</strong> {user.rejectionReason}
          </p>
        )}
        {user.cinNumber && !canSubmit && (
          <dl className="details">
            <dt>Name</dt>
            <dd>
              {user.firstName} {user.lastName}
            </dd>
            <dt>CIN</dt>
            <dd>{user.cinNumber}</dd>
            <dt>Date of birth</dt>
            <dd>{user.dateOfBirth}</dd>
            <dt>CIN expires</dt>
            <dd>{user.cinExpiresAt}</dd>
          </dl>
        )}
      </div>
      {canSubmit && <IdentityForm token={token} user={user} />}
    </section>
  );
}

function IdentityForm({ token, user }: { token: string; user: UserProfile }) {
  const { setUser } = useAuth();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setUser(await api.submitIdentity(token, new FormData(event.currentTarget)));
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  const accept = IDENTITY_DOCUMENT_MIME_TYPES.join(',');
  const fe = error?.fieldErrors ?? {};

  return (
    <form className="form card" onSubmit={onSubmit} noValidate>
      <h2>Verify your identity</h2>
      <p className="muted">Enter the details exactly as printed on your CIN. Photos are only visible to Sakan admins.</p>
      <div className="row">
        <Field label="First name" name="firstName" defaultValue={user.firstName ?? ''} required error={fe.firstName} />
        <Field label="Last name" name="lastName" defaultValue={user.lastName ?? ''} required error={fe.lastName} />
      </div>
      <div className="row">
        <Field
          label="Date of birth"
          name="dateOfBirth"
          type="date"
          defaultValue={user.dateOfBirth ?? ''}
          required
          error={fe.dateOfBirth}
        />
        <Field
          label="CIN number"
          name="cinNumber"
          placeholder="AB123456"
          defaultValue={user.cinNumber ?? ''}
          required
          error={fe.cinNumber}
        />
        <Field
          label="CIN expiry date"
          name="cinExpiresAt"
          type="date"
          defaultValue={user.cinExpiresAt ?? ''}
          required
          error={fe.cinExpiresAt}
        />
      </div>
      <div className="row">
        <Field label="Front of the CIN" name="front" type="file" accept={accept} required hint="JPEG, PNG or WebP, up to 5 MB" />
        <Field label="Back of the CIN" name="back" type="file" accept={accept} required hint="JPEG, PNG or WebP, up to 5 MB" />
      </div>
      {error && Object.keys(fe).length === 0 && <p className="error">{error.message}</p>}
      <button type="submit" className="button" disabled={busy}>
        {busy ? 'Uploading…' : 'Submit for review'}
      </button>
    </form>
  );
}
