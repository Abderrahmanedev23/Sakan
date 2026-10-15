'use client';

import Link from 'next/link';
import { useI18n } from './i18n-provider';
import { Logo } from './logo';

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Link href="/" className="brand" aria-label="Sakan">
            <Logo inverted />
          </Link>
          <p>{t['footer.about']}</p>
        </div>
        <nav aria-label={t['footer.platform']}>
          <h3>{t['footer.platform']}</h3>
          <Link href="/#sessions">{t['nav.sessions']}</Link>
          <Link href="/#steps">{t['nav.steps']}</Link>
          <Link href="/signup">{t['nav.signUp']}</Link>
        </nav>
        <nav aria-label={t['footer.help']}>
          <h3>{t['footer.help']}</h3>
          <Link href="/#faq">{t['nav.faq']}</Link>
          <Link href="/login">{t['nav.signIn']}</Link>
        </nav>
      </div>
      <div className="footer-bottom">
        <div className="container">{t['footer.rights'](new Date().getFullYear())}</div>
      </div>
    </footer>
  );
}
