'use client';

import { PASSWORD_MIN_LENGTH } from '@sakan/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/field';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function SignUpPage() {
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
      signIn(
        await api.register({
          email: String(form.get('email')),
          password: String(form.get('password')),
          phone: String(form.get('phone') ?? '') || undefined,
        }),
      );
      router.push('/profile');
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, 'Something went wrong'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="narrow">
      <h1>Create your account</h1>
      <p className="muted">After signing up you will verify your identity with your CIN.</p>
      <form className="form" onSubmit={onSubmit} noValidate>
        <Field label="Email" name="email" type="email" autoComplete="email" required error={error?.fieldErrors.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          required
          hint={`At least ${PASSWORD_MIN_LENGTH} characters`}
          error={error?.fieldErrors.password}
        />
        <Field
          label="Phone (optional)"
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="0612345678"
          error={error?.fieldErrors.phone}
        />
        {error && Object.keys(error.fieldErrors).length === 0 && <p className="error">{error.message}</p>}
        <button type="submit" className="button" disabled={busy}>
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="muted">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </section>
  );
}
