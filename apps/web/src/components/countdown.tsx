'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './i18n-provider';

/** Live countdown to `to`, e.g. "2j 03:14:05". Calls onDone once when it reaches zero. */
export function Countdown({ to, onDone }: { to: string; onDone?: () => void }) {
  const { t } = useI18n();
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = now === null ? null : Math.max(0, Math.floor((target - now) / 1000));
  useEffect(() => {
    if (left === 0) onDone?.();
  }, [left, onDone]);

  if (left === null) return <span className="countdown">--:--:--</span>;
  const days = Math.floor(left / 86_400);
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(Math.floor((left % 86_400) / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  return (
    <span className="countdown" dir="ltr">
      {days > 0 && `${days}${t['sessions.days']} `}
      {clock}
    </span>
  );
}
