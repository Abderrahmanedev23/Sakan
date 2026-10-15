'use client';

import type { AdminSession, UpdateSessionInput } from '@sakan/shared';
import { useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import { Field } from './field';
import { useI18n } from './i18n-provider';

/** "2026-10-15T18:00" for <input type="datetime-local"> from an ISO string, in the browser's time zone. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Create / edit form for a draw session. Once the session is no longer a draft, only the
 * name, description and closing time are sent (the API rejects other changes).
 */
export function SessionForm({
  session,
  submitLabel,
  onSubmit,
}: {
  session?: AdminSession;
  submitLabel: string;
  onSubmit: (input: UpdateSessionInput) => Promise<void>;
}) {
  const { t } = useI18n();
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = Boolean(session && session.status !== 'DRAFT');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? '').trim();
    const number = (name: string) => (text(name) === '' ? null : Number(text(name).replace(',', '.')));
    const date = (name: string) => (text(name) ? new Date(text(name)).toISOString() : null);

    const editable = { name: text('name'), description: text('description') || null, closesAt: date('closesAt') };
    const input: UpdateSessionInput = locked
      ? editable
      : {
          ...editable,
          entryPriceCents: Math.round((number('price') ?? NaN) * 100),
          targetEntries: number('targetEntries') ?? NaN,
          winnerCount: number('winnerCount') ?? 1,
          maxEntriesPerUser: number('maxEntriesPerUser'),
          allowOverfill: form.get('allowOverfill') === 'on',
          drawTimeOfDay: text('drawTimeOfDay'),
          timezone: text('timezone'),
          drawDelayMinutes: number('drawDelayMinutes'),
          opensAt: date('opensAt'),
        };
    setBusy(true);
    setError(null);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, t['common.error']));
    } finally {
      setBusy(false);
    }
  }

  const fe = error?.fieldErrors ?? {};
  return (
    <form className="form card" onSubmit={submit} noValidate>
      {locked && <p className="muted">{t['adminS.form.lockedHint']}</p>}
      <Field label={t['adminS.form.name']} name="name" defaultValue={session?.name} required error={fe.name} />
      <label className="field">
        <span>{t['adminS.form.description']}</span>
        <textarea name="description" rows={3} defaultValue={session?.description ?? ''} />
      </label>
      <div className="row">
        <Field
          label={t['adminS.form.price']}
          name="price"
          type="number"
          min="1"
          step="0.01"
          defaultValue={session ? session.entryPriceCents / 100 : 100}
          disabled={locked}
          error={fe.entryPriceCents}
        />
        <Field
          label={t['adminS.form.target']}
          name="targetEntries"
          type="number"
          min="1"
          defaultValue={session?.targetEntries ?? 3000}
          disabled={locked}
          error={fe.targetEntries}
        />
        <Field
          label={t['adminS.form.winners']}
          name="winnerCount"
          type="number"
          min="1"
          defaultValue={session?.winnerCount ?? 1}
          disabled={locked}
          error={fe.winnerCount}
        />
        <Field
          label={t['adminS.form.maxPerUser']}
          name="maxEntriesPerUser"
          type="number"
          min="1"
          defaultValue={session?.maxEntriesPerUser ?? ''}
          disabled={locked}
          hint={t['adminS.form.maxHint']}
          error={fe.maxEntriesPerUser}
        />
      </div>
      <div className="row">
        <Field
          label={t['adminS.form.drawTime']}
          name="drawTimeOfDay"
          type="time"
          defaultValue={session?.drawTimeOfDay ?? '18:00'}
          disabled={locked}
          error={fe.drawTimeOfDay}
        />
        <Field
          label={t['adminS.form.timezone']}
          name="timezone"
          defaultValue={session?.timezone ?? 'Africa/Casablanca'}
          disabled={locked}
          error={fe.timezone}
        />
        <Field
          label={t['adminS.form.delay']}
          name="drawDelayMinutes"
          type="number"
          min="1"
          defaultValue={session?.drawDelayMinutes ?? ''}
          disabled={locked}
          hint={t['adminS.form.delayHint']}
          error={fe.drawDelayMinutes}
        />
      </div>
      <div className="row">
        <Field
          label={t['adminS.form.opensAt']}
          name="opensAt"
          type="datetime-local"
          defaultValue={toLocalInput(session?.opensAt)}
          disabled={locked}
          error={fe.opensAt}
        />
        <Field
          label={t['adminS.form.closesAt']}
          name="closesAt"
          type="datetime-local"
          defaultValue={toLocalInput(session?.closesAt)}
          error={fe.closesAt}
        />
      </div>
      <label className="checkbox">
        <input type="checkbox" name="allowOverfill" defaultChecked={session?.allowOverfill ?? false} disabled={locked} />
        <span>{t['adminS.form.overfill']}</span>
      </label>
      {error && <p className="error">{Object.keys(fe).length ? Object.values(fe).join(' · ') : error.message}</p>}
      <button type="submit" className="button" disabled={busy}>
        {submitLabel}
      </button>
    </form>
  );
}
