import { createHash, randomBytes } from 'node:crypto';

/** A 256-bit random bearer token. Only its hash is stored. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
