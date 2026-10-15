'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from './i18n-provider';

export function Nav() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const active = (href: string) => (pathname === href ? 'page' : undefined);

  return (
    <nav className="nav">
      <div className="nav-links">
        <Link href="/" aria-current={active('/')}>{t['nav.home']}</Link>
        <Link href="/#steps">{t['nav.steps']}</Link>
        <Link href="/results" aria-current={active('/results')}>{t['nav.results']}</Link>
        <Link href="/#faq">{t['nav.faq']}</Link>
        {user?.role === 'ADMIN' && <Link href="/admin/sessions" aria-current={pathname.startsWith('/admin') ? 'page' : undefined}>{t['nav.admin']}</Link>}
        {user && user.role !== 'ADMIN' && (
          <Link href="/participations" aria-current={active('/participations')}>{t['nav.participations']}</Link>
        )}
        {user && <Link href="/profile" aria-current={active('/profile')}>{t['nav.account']}</Link>}
      </div>
      <div className="nav-actions">
        {user ? (
          <button
            type="button"
            className="button secondary small"
            onClick={async () => {
              await signOut();
              router.push('/');
            }}
          >
            {t['nav.signOut']}
          </button>
        ) : user === null ? (
          <>
            <Link href="/login" className="button secondary small">{t['nav.signIn']}</Link>
            <Link href="/signup" className="button small">{t['nav.signUp']}</Link>
          </>
        ) : null}
      </div>
    </nav>
  );
}
