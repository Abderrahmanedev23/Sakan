'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from './i18n-provider';
import { LanguageSelect } from './language-select';

export function Nav() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (pathname === href ? 'page' : undefined);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <nav className="nav">
      <div id="main-menu" className={open ? 'nav-menu open' : 'nav-menu'}>
        <div className="nav-links" onClick={() => setOpen(false)}>
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
      </div>
      <div className="nav-tools">
        <LanguageSelect />
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={open}
          aria-controls="main-menu"
          aria-label={t['nav.menu']}
          onClick={() => setOpen((value) => !value)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
    </nav>
  );
}
