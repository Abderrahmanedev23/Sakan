import type { PublicSession } from '@sakan/shared';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDateTime, intlLocale } from '@/lib/i18n';
import { getDictionary } from '@/lib/locale';

export const dynamic = 'force-dynamic';

const STEPS = ['steps.1', 'steps.2', 'steps.3', 'steps.4'] as const;
const FAQ = [1, 2, 3, 4, 5] as const;

const STEP_ICONS = [
  // account
  <path key="0" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  // id card
  <path key="1" d="M3 6h18v12H3zM7 14h4M14 10h4M14 14h4M8.5 10.5a1.5 1.5 0 1 0 0-.01" />,
  // ticket
  <path key="2" d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM13 7v10" />,
  // trophy
  <path key="3" d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" />,
];

function formatPrice(cents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

export default async function HomePage() {
  const { locale, t } = await getDictionary();
  let sessions: PublicSession[] = [];
  let error: string | null = null;
  try {
    sessions = await api.listSessions();
  } catch {
    error = t['sessions.apiDown'];
  }

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-text">
            <h1>{t['hero.title']}</h1>
            <p>{t['hero.body']}</p>
            <div className="hero-actions">
              <Link href="/signup" className="button">{t['hero.cta']}</Link>
              <Link href="#sessions" className="text-link">{t['hero.secondary']}</Link>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <svg viewBox="0 0 120 120" width="160" height="160">
              <path d="M18 58 60 22l42 36" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M32 52v46h56V52" fill="none" stroke="currentColor" strokeWidth="7" strokeLinejoin="round" />
              <rect x="51" y="70" width="18" height="28" rx="2" fill="currentColor" />
            </svg>
          </div>
        </div>
      </section>

      <section id="steps" className="section patterned">
        <div className="container">
          <h2 className="section-title">{t['steps.title']}</h2>
          <ol className="steps">
            {STEPS.map((key, i) => (
              <li key={key} className="step">
                <span className="step-number">{String(i + 1).padStart(2, '0')}</span>
                <span className="step-label">{t[key]}</span>
                <svg className="step-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
                  {STEP_ICONS[i]}
                </svg>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="sessions" className="section">
        <div className="container">
          <h2 className="section-title">{t['sessions.title']}</h2>
          {error && <p className="muted center">{error}</p>}
          {!error && sessions.length === 0 && <p className="muted center">{t['sessions.empty']}</p>}
          <div className="grid">
            {sessions.map((s) => {
              const pct = Math.min(100, (s.confirmedEntries / s.targetEntries) * 100);
              return (
                <article key={s.id} className="card session-card">
                  <h3>{s.name}</h3>
                  <p className="muted">
                    {s.status} · {t['sessions.perEntry'](formatPrice(s.entryPriceCents, s.currency, intlLocale(locale)))}
                  </p>
                  <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                  <p>{t['sessions.entries'](s.confirmedEntries, s.targetEntries)}</p>
                  {s.drawScheduledAt && <p>{t['sessions.draw'](formatDateTime(s.drawScheduledAt, locale))}</p>}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="faq" className="section patterned-soft">
        <div className="container">
          <h2 className="section-title start">{t['faq.title']}</h2>
          <div className="faq">
            {FAQ.map((n) => (
              <details key={n} className="faq-item">
                <summary>
                  <span className="faq-number">{String(n).padStart(2, '0')}</span>
                  <span>{t[`faq.q${n}`]}</span>
                </summary>
                <p>{t[`faq.a${n}`]}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
