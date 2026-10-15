import type { PublicSession } from '@sakan/shared';
import { SessionCard } from '@/components/session-card';
import { api } from '@/lib/api';
import { getDictionary } from '@/lib/locale';

export const dynamic = 'force-dynamic';

export default async function ResultsPage() {
  const { t } = await getDictionary();
  let sessions: PublicSession[] = [];
  let error: string | null = null;
  try {
    sessions = await api.listSessions('completed');
  } catch {
    error = t['sessions.apiDown'];
  }

  return (
    <div className="page">
      <h1>{t['results.title']}</h1>
      <p className="muted">{t['results.intro']}</p>
      {error && <p className="error">{error}</p>}
      {!error && sessions.length === 0 && <p className="muted">{t['results.empty']}</p>}
      <div className="grid">
        {sessions.map((s) => (
          <SessionCard key={s.id} session={s} />
        ))}
      </div>
    </div>
  );
}
