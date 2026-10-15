'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useI18n } from './i18n-provider';

const LINKS = [
  { href: '/admin/sessions', label: 'admin.nav.sessions' },
  { href: '/admin', label: 'admin.nav.identities' },
  { href: '/admin/payments', label: 'admin.nav.payments' },
  { href: '/admin/audit', label: 'admin.nav.audit' },
] as const;

export function AdminNav() {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  if (user?.role !== 'ADMIN') return null;
  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' || pathname.startsWith('/admin/users') : pathname.startsWith(href);
  return (
    <nav className="admin-nav" aria-label={t['nav.admin']}>
      <div className="container admin-nav-inner">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} aria-current={isActive(link.href) ? 'page' : undefined}>
            {t[link.label]}
          </Link>
        ))}
      </div>
    </nav>
  );
}
