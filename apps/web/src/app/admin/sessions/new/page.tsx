'use client';

import type { CreateSessionInput } from '@sakan/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AdminOnly } from '@/components/admin-only';
import { useI18n } from '@/components/i18n-provider';
import { SessionForm } from '@/components/session-form';
import { api } from '@/lib/api';

export default function NewSessionPage() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <div className="page narrow-wide">
      <p>
        <Link href="/admin/sessions" className="text-link">{t['common.back']}</Link>
      </p>
      <h1>{t['adminS.form.newTitle']}</h1>
      <AdminOnly>
        {(token) => (
          <SessionForm
            submitLabel={t['adminS.form.create']}
            onSubmit={async (input) => {
              // A new session is never locked, so the form sent every field.
              const created = await api.admin.createSession(token, input as CreateSessionInput);
              router.push(`/admin/sessions/${created.id}`);
            }}
          />
        )}
      </AdminOnly>
    </div>
  );
}
