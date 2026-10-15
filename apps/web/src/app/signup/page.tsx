'use client';

import { PASSWORD_MIN_LENGTH } from '@sakan/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { useI18n } from '@/components/i18n-provider';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function SignUpPage() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      signIn(
        await api.register({
          email: String(form.get('email')),
          password: String(form.get('password')),
          phone: String(form.get('phone') ?? '') || undefined,
        }),
      );
      router.push('/profile');
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, t['common.error']));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="card narrow auth-card">
      <h1>{t['signup.title']}</h1>
      <p className="muted">{t['signup.intro']}</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        <Field label={t['common.email']} name="email" type="email" autoComplete="email" required error={error?.fieldErrors.email} />
        <Field
          label={t['common.password']}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
          hint={t['signup.passwordHint'](PASSWORD_MIN_LENGTH)}
          error={error?.fieldErrors.password}
        />
        <Field
          label={t['signup.phone']}
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="0612345678"
          error={error?.fieldErrors.phone}
        />
        {error && Object.keys(error.fieldErrors).length === 0 && <p className="error">{error.message}</p>}
        <button type="submit" className="button" disabled={busy}>
          {busy ? t['signup.busy'] : t['signup.submit']}
        </button>
      </form>
      <p className="muted">
        {t['signup.have']} <Link href="/login">{t['nav.signIn']}</Link>
      </p>
      </div>
    </section>
  );
}
