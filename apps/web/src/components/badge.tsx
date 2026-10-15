'use client';

import type { DrawStatus, EntryStatus, PaymentStatus, SessionStatus } from '@sakan/shared';
import { useI18n } from './i18n-provider';

/** Colour classes per status, reusing the badge palette of the identity badges. */
const TONE: Record<string, string> = {
  OPEN: 'approved',
  SUCCEEDED: 'approved',
  COMPLETED: 'approved',
  ACTIVE: 'approved',
  PENDING: 'pending',
  PAUSED: 'pending',
  FULL: 'pending',
  SCHEDULED: 'info',
  RUNNING: 'info',
  FAILED: 'rejected',
  CANCELLED: 'rejected',
  REFUNDED: 'rejected',
  VOID: 'rejected',
  DRAFT: 'neutral',
};

type Kind =
  | { kind: 'session'; status: SessionStatus }
  | { kind: 'payment'; status: PaymentStatus }
  | { kind: 'draw'; status: DrawStatus }
  | { kind: 'entry'; status: EntryStatus };

export function Badge(props: Kind) {
  const { t } = useI18n();
  const label = t[`${props.kind}.status.${props.status}` as keyof typeof t] as string;
  return <span className={`badge badge-${TONE[props.status] ?? 'neutral'}`}>{label}</span>;
}
