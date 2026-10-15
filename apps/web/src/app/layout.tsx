import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Nav } from '@/components/nav';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sakan',
  description: 'Transparent community draw sessions',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <header className="header">
            <Link href="/" className="brand">Sakan</Link>
            <Nav />
          </header>
          <main className="main">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
