'use client';

import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE } from '@/lib/i18n';
import { useI18n } from './i18n-provider';

export function LanguageSwitch() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const next = locale === 'ar' ? 'fr' : 'ar';

  return (
    <button
      type="button"
      className="lang-switch"
      aria-label={t['lang.label']}
      lang={next}
      onClick={() => {
        document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {t['lang.switch']}
    </button>
  );
}
