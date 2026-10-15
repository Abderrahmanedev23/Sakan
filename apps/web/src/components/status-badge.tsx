'use client';

import type { AccountStatus, VerificationStatus } from '@sakan/shared';
import { statusKey } from '@/lib/i18n';
import { useI18n } from './i18n-provider';

export function StatusBadge({ status }: { status: VerificationStatus | AccountStatus }) {
  const { t } = useI18n();
  return <span className={`badge badge-${status.toLowerCase()}`}>{t[statusKey(status)]}</span>;
}
