import type { SessionStatus } from './enums.js';

/** Allowed session status transitions. Anything not listed is rejected. */
export const SESSION_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['PAUSED', 'FULL', 'CANCELLED'],
  PAUSED: ['OPEN', 'CANCELLED'],
  FULL: ['SCHEDULED', 'CANCELLED'],
  SCHEDULED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return SESSION_TRANSITIONS[from].includes(to);
}

/** Public view of a draw session, as returned by GET /api/v1/sessions. */
export interface PublicSession {
  id: string;
  name: string;
  description: string | null;
  status: SessionStatus;
  /** Price per entry in the smallest currency unit (centimes for MAD). */
  entryPriceCents: number;
  currency: string;
  targetEntries: number;
  confirmedEntries: number;
  drawScheduledAt: string | null;
  createdAt: string;
}

export interface HealthResponse {
  status: 'ok';
  version: string;
  timestamp: string;
}
