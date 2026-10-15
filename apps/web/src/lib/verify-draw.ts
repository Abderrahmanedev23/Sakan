/**
 * Recomputes a completed draw in the browser with Web Crypto, exactly as the API does
 * (apps/api/src/draws/draw-selection.ts): SHA-256 of the seed must equal the published
 * seedHash, SHA-256 of the entry references joined by newlines must equal entriesHash, and
 * HMAC-SHA256(seed, `${entriesHash}:${counter}`) with rejection sampling picks the winners.
 */
const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface DrawCheck {
  seedMatches: boolean;
  entriesMatch: boolean;
  winners: string[];
}

export async function verifyDraw(input: {
  seed: string;
  seedHash: string;
  entriesHash: string;
  references: string[];
  winnerCount: number;
}): Promise<DrawCheck> {
  const seedMatches = (await sha256Hex(input.seed)) === input.seedHash;
  const entriesHash = await sha256Hex(input.references.join('\n'));
  const entriesMatch = entriesHash === input.entriesHash;

  const total = input.references.length;
  const count = Math.min(input.winnerCount, total);
  const key = await crypto.subtle.importKey('raw', encoder.encode(input.seed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const limit = 2 ** 48 - (2 ** 48 % total);
  const indexes: number[] = [];
  for (let counter = 0; indexes.length < count && counter < 10_000; counter++) {
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${entriesHash}:${counter}`)));
    // First 6 bytes as a big-endian integer, like Buffer.readUIntBE(0, 6).
    let value = 0;
    for (let i = 0; i < 6; i++) value = value * 256 + mac[i];
    if (value >= limit) continue;
    const index = value % total;
    if (!indexes.includes(index)) indexes.push(index);
  }
  return { seedMatches, entriesMatch, winners: indexes.map((i) => input.references[i]) };
}
