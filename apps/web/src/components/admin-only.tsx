'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

/** Renders children with the admin's token; the API enforces the role, this only avoids a broken page. */
export function AdminOnly({ children }: { children: (token: string) => ReactNode }) {
  const { user, token } = useAuth();
  if (user === undefined) return <p className="muted">Loading…</p>;
  if (!user || !token) {
    return (
      <p>
        <Link href="/login">Sign in</Link> with an admin account.
      </p>
    );
  }
  if (user.role !== 'ADMIN') return <p className="muted">This page is for admins only.</p>;
  return <>{children(token)}</>;
}
