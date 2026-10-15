import type { PublicSession } from '@sakan/shared';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

function formatMad(cents: number, currency: string) {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency }).format(cents / 100);
}

export default async function HomePage() {
  let sessions: PublicSession[] = [];
  let error: string | null = null;
  try {
    sessions = await api.listSessions();
  } catch {
    error = 'The API is not reachable. Start it with `pnpm dev:api`.';
  }

  return (
    <>
      <h1>Draw sessions</h1>
      {error && <p className="muted">{error}</p>}
      {!error && sessions.length === 0 && <p className="muted">No open sessions yet.</p>}
      <div className="grid">
        {sessions.map((s) => {
          const pct = Math.min(100, (s.confirmedEntries / s.targetEntries) * 100);
          return (
            <article key={s.id} className="card">
              <h2>{s.name}</h2>
              <p className="muted">{s.status} · {formatMad(s.entryPriceCents, s.currency)} per entry</p>
              <div className="progress"><div style={{ width: `${pct}%` }} /></div>
              <p>{s.confirmedEntries} / {s.targetEntries} entries</p>
              {s.drawScheduledAt && <p>Draw: {new Date(s.drawScheduledAt).toLocaleString('fr-MA')}</p>}
            </article>
          );
        })}
      </div>
    </>
  );
}
