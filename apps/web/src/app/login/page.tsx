'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { useI18n } from '@/components/i18n-provider';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
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
      const response = await api.login({ email: String(form.get('email')), password: String(form.get('password')) });
      signIn(response);
      router.push(response.user.role === 'ADMIN' ? '/admin/sessions' : '/profile');
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, t['common.error']));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="card narrow auth-card">
      <h1>{t['login.title']}</h1>
      <form className="form" onSubmit={onSubmit} noValidate>
        <Field label={t['common.email']} name="email" type="email" autoComplete="email" required error={error?.fieldErrors.email} />
        <Field
          label={t['common.password']}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={error?.fieldErrors.password}
        />
        {error && Object.keys(error.fieldErrors).length === 0 && <p className="error">{error.message}</p>}
        <button type="submit" className="button" disabled={busy}>
          {busy ? t['login.busy'] : t['login.submit']}
        </button>
      </form>
      <p className="muted">
        {t['login.new']} <Link href="/signup">{t['login.create']}</Link>
      </p>
      </div>
    </section>
  );
}
