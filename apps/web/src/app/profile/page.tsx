'use client';

import { IDENTITY_DOCUMENT_MIME_TYPES, type UserProfile } from '@sakan/shared';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { useI18n } from '@/components/i18n-provider';
import { StatusBadge } from '@/components/status-badge';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ProfilePage() {
  const { user, token } = useAuth();
  const { t } = useI18n();

  if (user === undefined) return <p className="page muted">{t['common.loading']}</p>;
  if (!user || !token) {
    return (
      <p className="page">
        <Link href="/login">{t['nav.signIn']}</Link> {t['profile.signInPrompt']}
      </p>
    );
  }

  const canSubmit = user.verificationStatus === 'UNSUBMITTED' || user.verificationStatus === 'REJECTED';

  return (
    <section className="page narrow">
      <h1>{t['profile.title']}</h1>
      <div className="card">
        <p>
          <strong>{user.email}</strong>
          {user.phone && <span className="muted"> · {user.phone}</span>}
        </p>
        <p>
          {t['profile.identity']} <StatusBadge status={user.verificationStatus} />
          {user.accountStatus !== 'ACTIVE' && (
            <>
              {' '}
              {t['profile.account']} <StatusBadge status={user.accountStatus} />
            </>
          )}
        </p>
        <p className="muted">{t[`profile.status.${user.verificationStatus}`]}</p>
        {user.rejectionReason && (
          <p className="notice">
            <strong>{t['profile.reason']}</strong> {user.rejectionReason}
          </p>
        )}
        {user.cinNumber && !canSubmit && (
          <dl className="details">
            <dt>{t['field.name']}</dt>
            <dd>
              {user.firstName} {user.lastName}
            </dd>
            <dt>{t['field.cin']}</dt>
            <dd>{user.cinNumber}</dd>
            <dt>{t['field.dateOfBirth']}</dt>
            <dd>{user.dateOfBirth}</dd>
            <dt>{t['field.cinExpires']}</dt>
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
  const { t } = useI18n();
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
      setError(err instanceof ApiError ? err : new ApiError(0, t['common.error']));
    } finally {
      setBusy(false);
    }
  }

  const accept = IDENTITY_DOCUMENT_MIME_TYPES.join(',');
  const fe = error?.fieldErrors ?? {};

  return (
    <form className="form card" onSubmit={onSubmit} noValidate>
      <h2>{t['profile.formTitle']}</h2>
      <p className="muted">{t['profile.formIntro']}</p>
      <div className="row">
        <Field label={t['field.firstName']} name="firstName" defaultValue={user.firstName ?? ''} required error={fe.firstName} />
        <Field label={t['field.lastName']} name="lastName" defaultValue={user.lastName ?? ''} required error={fe.lastName} />
      </div>
      <div className="row">
        <Field
          label={t['field.dateOfBirth']}
          name="dateOfBirth"
          type="date"
          defaultValue={user.dateOfBirth ?? ''}
          required
          error={fe.dateOfBirth}
        />
        <Field
          label={t['field.cinNumber']}
          name="cinNumber"
          placeholder="AB123456"
          defaultValue={user.cinNumber ?? ''}
          required
          error={fe.cinNumber}
        />
        <Field
          label={t['field.cinExpiresAt']}
          name="cinExpiresAt"
          type="date"
          defaultValue={user.cinExpiresAt ?? ''}
          required
          error={fe.cinExpiresAt}
        />
      </div>
      <div className="row">
        <Field label={t['field.front']} name="front" type="file" accept={accept} required hint={t['profile.fileHint']} />
        <Field label={t['field.back']} name="back" type="file" accept={accept} required hint={t['profile.fileHint']} />
      </div>
      {error && Object.keys(fe).length === 0 && <p className="error">{error.message}</p>}
      <button type="submit" className="button" disabled={busy}>
        {busy ? t['profile.busy'] : t['profile.submit']}
      </button>
    </form>
  );
}
