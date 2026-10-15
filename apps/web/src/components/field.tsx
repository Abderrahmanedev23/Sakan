import type { InputHTMLAttributes } from 'react';

/** Labelled input that shows the API's message for this field, if any. */
export function Field({
  label,
  error,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...input} aria-invalid={Boolean(error)} />
      {error ? <small className="error">{error}</small> : hint ? <small className="muted">{hint}</small> : null}
    </label>
  );
}
