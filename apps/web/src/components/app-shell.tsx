'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import type { Dictionary } from '@/lib/i18n';
import { useI18n } from './i18n-provider';

type LinkKey = { [K in keyof Dictionary]: Dictionary[K] extends string ? K : never }[keyof Dictionary];
interface SidebarLink {
  href: string;
  label: LinkKey;
  active: (pathname: string) => boolean;
}

const ADMIN_LINKS: SidebarLink[] = [
  { href: '/admin/sessions', label: 'admin.nav.sessions', active: (p) => p.startsWith('/admin/sessions') },
  { href: '/admin', label: 'admin.nav.identities', active: (p) => p === '/admin' || p.startsWith('/admin/users') },
  { href: '/admin/payments', label: 'admin.nav.payments', active: (p) => p.startsWith('/admin/payments') },
  { href: '/admin/audit', label: 'admin.nav.audit', active: (p) => p.startsWith('/admin/audit') },
];
const ACCOUNT_LINK: SidebarLink = { href: '/profile', label: 'nav.account', active: (p) => p === '/profile' };
const PARTICIPATIONS_LINK: SidebarLink = {
  href: '/participations',
  label: 'nav.participations',
  active: (p) => p === '/participations',
};

/** The signed-in area: a side menu next to the page, folded into a toggle on small screens. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  if (!user) return <>{children}</>;
  const groups: { title?: LinkKey; links: SidebarLink[] }[] =
    user.role === 'ADMIN'
      ? [
          { title: 'nav.admin', links: ADMIN_LINKS },
          { links: [ACCOUNT_LINK] },
        ]
      : [{ title: 'nav.account', links: [ACCOUNT_LINK, PARTICIPATIONS_LINK] }];

  return (
    <div className="container shell">
      <aside className="sidebar">
        <button
          type="button"
          className="sidebar-toggle"
          aria-expanded={open}
          aria-controls="sidebar-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {t['nav.menu']}
        </button>
        <nav id="sidebar-menu" className={open ? 'sidebar-menu open' : 'sidebar-menu'} aria-label={t['nav.menu']}>
          {groups.map((group, index) => (
            <div key={index} className="sidebar-group">
              {group.title && <span className="sidebar-title">{t[group.title]}</span>}
              {group.links.map((link) => (
                <Link key={link.href} href={link.href} aria-current={link.active(pathname) ? 'page' : undefined}>
                  {t[link.label]}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <div className="shell-main">{children}</div>
    </div>
  );
}
