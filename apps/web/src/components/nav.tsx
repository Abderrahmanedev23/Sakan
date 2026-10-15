'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

export function Nav() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  return (
    <nav>
      <Link href="/">Sessions</Link>
      {user?.role === 'ADMIN' && <Link href="/admin">Admin</Link>}
      {user ? (
        <>
          <Link href="/profile">My account</Link>
          <button
            type="button"
            className="link"
            onClick={async () => {
              await signOut();
              router.push('/');
            }}
          >
            Sign out
          </button>
        </>
      ) : user === null ? (
        <>
          <Link href="/login">Sign in</Link>
          <Link href="/signup">Sign up</Link>
        </>
      ) : null}
    </nav>
  );
}
