import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sakan',
  description: 'Transparent community draw sessions',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <header className="header">
          <Link href="/" className="brand">Sakan</Link>
          <nav>
            <Link href="/">Sessions</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
