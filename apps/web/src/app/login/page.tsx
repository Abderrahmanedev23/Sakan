'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { signIn } = useAuth();
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
      router.push(response.user.role === 'ADMIN' ? '/admin' : '/profile');
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="narrow">
      <h1>Sign in</h1>
      <form className="form" onSubmit={onSubmit} noValidate>
        <Field label="Email" name="email" type="email" autoComplete="email" required error={error?.fieldErrors.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={error?.fieldErrors.password}
        />
        {error && Object.keys(error.fieldErrors).length === 0 && <p className="error">{error.message}</p>}
        <button type="submit" className="button" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="muted">
        New here? <Link href="/signup">Create an account</Link>
      </p>
    </section>
  );
}
