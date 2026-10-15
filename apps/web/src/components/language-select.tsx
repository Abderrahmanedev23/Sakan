'use client';

import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, LOCALES, dictionaries, isLocale } from '@/lib/i18n';
import { useI18n } from './i18n-provider';

/** Lists every language that has a dictionary in lib/i18n, each under its own name. */
export function LanguageSelect() {
  const { locale, t } = useI18n();
  const router = useRouter();

  return (
    <select
      className="lang-select"
      aria-label={t['lang.label']}
      value={locale}
      onChange={(e) => {
        const next = e.target.value;
        if (!isLocale(next)) return;
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {LOCALES.map((l) => (
        <option key={l} value={l} lang={l}>
          {dictionaries[l]['lang.name']}
        </option>
      ))}
    </select>
  );
}
