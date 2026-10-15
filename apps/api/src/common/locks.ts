import type { Prisma } from '../generated/prisma/client.js';

/**
 * Locks a session row until the transaction ends. Every change to a session's entries,
 * counters or status takes this lock first, so checkouts, payment confirmations, refunds
 * and admin actions on one session run one at a time and the target can't be overshot.
 */
export async function lockSession(tx: Prisma.TransactionClient, sessionId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM \`DrawSession\` WHERE id = ${sessionId} FOR UPDATE`;
}
