import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { I18nProvider } from '@/components/i18n-provider';
import { Logo } from '@/components/logo';
import { Nav } from '@/components/nav';
import { SiteFooter } from '@/components/site-footer';
import { AuthProvider } from '@/lib/auth';
import { dirOf } from '@/lib/i18n';
import { getDictionary } from '@/lib/locale';
import './globals.css';

const cairo = Cairo({ subsets: ['arabic', 'latin'], display: 'swap', variable: '--font-cairo' });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return { title: 'Sakan · سكن', description: t['meta.description'] };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale } = await getDictionary();
  return (
    <html lang={locale} dir={dirOf(locale)} className={cairo.variable}>
      <body>
        <I18nProvider locale={locale}>
          <AuthProvider>
            <header className="header">
              <div className="container header-inner">
                <Link href="/" className="brand" aria-label="Sakan">
                  <Logo />
                </Link>
                <Nav />
              </div>
            </header>
            <main className="main">{children}</main>
            <SiteFooter />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
