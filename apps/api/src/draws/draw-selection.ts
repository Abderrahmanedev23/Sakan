import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * Verifiable winner selection (commit-reveal).
 *
 * 1. When a draw is scheduled, a random seed is generated and only its
 *    SHA-256 hash is published (`seedHash`), so the seed can't be changed later.
 * 2. At draw time, the eligible entries are frozen in sequence order and
 *    hashed (`entriesHash`).
 * 3. Winners are derived from HMAC-SHA256(seed, entriesHash || counter).
 * 4. The seed is published afterwards; anyone can recompute the result.
 */
export function generateSeed(): { seed: string; seedHash: string } {
  const seed = randomBytes(32).toString('hex');
  return { seed, seedHash: sha256(seed) };
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Hash of the ordered entry references, one per line. */
export function hashEntries(orderedReferences: readonly string[]): string {
  return sha256(orderedReferences.join('\n'));
}

/**
 * Returns `count` distinct zero-based indexes in [0, total), deterministic
 * for a given seed and entries hash. Uses rejection sampling to avoid modulo bias.
 */
export function pickWinnerIndexes(seed: string, entriesHash: string, total: number, count: number): number[] {
  if (!Number.isInteger(total) || total <= 0) throw new Error('No eligible entries');
  if (count > total) throw new Error('More winners than entries');

  const limit = 2 ** 48 - (2 ** 48 % total);
  const winners: number[] = [];
  for (let counter = 0; winners.length < count; counter++) {
    const digest = createHmac('sha256', seed).update(`${entriesHash}:${counter}`).digest();
    const value = digest.readUIntBE(0, 6);
    if (value >= limit) continue;
    const index = value % total;
    if (!winners.includes(index)) winners.push(index);
  }
  return winners;
}
