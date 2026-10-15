'use client';

import type { PublicSession } from '@sakan/shared';
import Link from 'next/link';
import { formatDateTime, formatPrice } from '@/lib/i18n';
import { Badge } from './badge';
import { Countdown } from './countdown';
import { useI18n } from './i18n-provider';

export function SessionCard({ session: s }: { session: PublicSession }) {
  const { locale, t } = useI18n();
  const pct = Math.min(100, (s.confirmedEntries / s.targetEntries) * 100);
  const winner = s.draw?.winners[0];
  return (
    <article className="card session-card">
      <div className="card-head">
        <h3>
          <Link href={`/sessions/${s.id}`}>{s.name}</Link>
        </h3>
        <Badge kind="session" status={s.status} />
      </div>
      <p className="muted">{t['sessions.perEntry'](formatPrice(s.entryPriceCents, s.currency, locale))}</p>
      <div className="progress" role="progressbar" aria-valuenow={s.confirmedEntries} aria-valuemax={s.targetEntries}>
        <div style={{ width: `${pct}%` }} />
      </div>
      <p>{t['sessions.entries'](s.confirmedEntries, s.targetEntries)}</p>
      {s.status === 'SCHEDULED' && s.drawScheduledAt && (
        <p>
          {t['sessions.drawIn']} <Countdown to={s.drawScheduledAt} />
        </p>
      )}
      {s.status === 'COMPLETED' && winner && (
        <p>
          {t['results.winner']} <strong>{winner.displayName}</strong> · <code>{winner.entryReference}</code>
        </p>
      )}
      {s.drawScheduledAt && s.status !== 'SCHEDULED' && <p className="muted small">{t['sessions.draw'](formatDateTime(s.drawScheduledAt, locale))}</p>}
      <Link href={`/sessions/${s.id}`} className="button small">
        {s.acceptingEntries ? t['session.buy'] : t['sessions.details']}
      </Link>
    </article>
  );
}
