'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from './i18n-provider';

/** Renders children with the admin's token; the API enforces the role, this only avoids a broken page. */
export function AdminOnly({ children }: { children: (token: string) => ReactNode }) {
  const { user, token } = useAuth();
  const { t } = useI18n();
  if (user === undefined) return <p className="muted">{t['common.loading']}</p>;
  if (!user || !token) {
    return (
      <p>
        <Link href="/login">{t['nav.signIn']}</Link> {t['admin.signInPrompt']}
      </p>
    );
  }
  if (user.role !== 'ADMIN') return <p className="muted">{t['admin.only']}</p>;
  return <>{children(token)}</>;
}
