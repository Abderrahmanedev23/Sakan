// Fills a local database with demo data: an admin, approved participants, a pending identity
// review, and sessions in every interesting state (open, almost full, scheduled, completed, draft).
// Usage (after `pnpm build`): pnpm db:seed   (only into an empty database)
//                             pnpm db:reset  (wipes every table first, then seeds)
// Never run against production: it refuses when NODE_ENV=production.
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { formatEntryReference } from '@sakan/shared';
import { createHash, randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { hashPassword } from '../auth/password.js';
import { nextDrawTime } from '../draws/draw-schedule.js';
import { generateSeed, hashEntries, pickWinnerIndexes } from '../draws/draw-selection.js';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';
import { StorageService } from '../storage/storage.service.js';

const ADMIN = { email: 'admin@sakan.ma', password: 'SakanAdmin2026!' };
const DEMO = { email: 'demo@sakan.ma', password: 'SakanDemo2026!' };
const PENDING = { email: 'pending@sakan.ma', password: 'SakanDemo2026!' };
const PARTICIPANT_PASSWORD = 'SakanDemo2026!';

const FIRST_NAMES = ['Youssef', 'Fatima', 'Mohamed', 'Khadija', 'Amine', 'Salma', 'Omar', 'Imane', 'Hamza', 'Zineb', 'Mehdi', 'Hiba', 'Ayoub', 'Nadia', 'Reda', 'Sara', 'Anas', 'Meryem', 'Karim', 'Laila'];
const LAST_NAMES = ['Alaoui', 'Bennani', 'El Idrissi', 'Tazi', 'Berrada', 'Chraibi', 'Fassi', 'Amrani', 'Benjelloun', 'Lahlou', 'Squalli', 'Ouazzani', 'Kettani', 'Naciri', 'Sebti'];

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data with NODE_ENV=production.');
  process.exit(1);
}

const reset = process.argv.includes('--reset');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const storage = new StorageService(new ConfigService(process.env));

/** A plain coloured PNG used as a stand-in CIN scan, so the admin review screen has images to show. */
function placeholderPng(width: number, height: number, rgb: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3)]);
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let cinCounter = 100000;
function nextCin(): string {
  cinCounter += 1;
  return `BK${cinCounter}`;
}

async function createUser(
  email: string,
  password: string,
  opts: { role?: 'ADMIN' | 'USER'; verification: 'APPROVED' | 'PENDING' | 'UNSUBMITTED'; firstName?: string; lastName?: string; reviewerId?: string },
) {
  const now = new Date();
  const withIdentity = opts.verification !== 'UNSUBMITTED';
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: opts.role ?? 'USER',
      verificationStatus: opts.verification,
      ...(withIdentity
        ? {
            firstName: opts.firstName,
            lastName: opts.lastName,
            dateOfBirth: new Date('1990-05-14'),
            cinNumber: nextCin(),
            cinExpiresAt: new Date(`${now.getUTCFullYear() + 6}-01-01`),
            identitySubmittedAt: new Date(now.getTime() - 3 * 86_400_000),
            verifiedAt: opts.verification === 'APPROVED' ? new Date(now.getTime() - 2 * 86_400_000) : null,
          }
        : {}),
    },
  });
  if (withIdentity) {
    for (const [side, color] of [['FRONT', [214, 230, 196]], ['BACK', [196, 214, 230]]] as const) {
      const png = placeholderPng(480, 300, [...color]);
      const storageKey = `identity/${user.id}/${randomUUID()}.png`;
      await storage.put(storageKey, png);
      await prisma.identityDocument.create({
        data: { userId: user.id, side, storageKey, mimeType: 'image/png', sizeBytes: png.length, sha256: createHash('sha256').update(png).digest('hex') },
      });
    }
  }
  if (opts.verification === 'APPROVED' && opts.reviewerId) {
    await prisma.verificationReview.create({ data: { userId: user.id, reviewerId: opts.reviewerId, decision: 'APPROVED' } });
  }
  return user;
}

/** Records `count` paid entries for a session, spread over the given users, as the payment flow would. */
async function addPaidEntries(session: { id: string; number: number; entryPriceCents: number }, users: { id: string }[], count: number, since: Date) {
  const span = Date.now() - since.getTime();
  for (let i = 1; i <= count; i++) {
    const user = users[(i * 7) % users.length];
    const at = new Date(since.getTime() + (span * i) / (count + 1));
    const payment = await prisma.payment.create({
      data: {
        reference: `PAY-SEED${String(session.number).padStart(2, '0')}${String(i).padStart(5, '0')}`,
        userId: user.id,
        sessionId: session.id,
        amountCents: session.entryPriceCents,
        status: 'SUCCEEDED',
        provider: 'stub',
        providerTransactionId: `stub_seed_${randomUUID()}`,
        idempotencyKey: `seed:${randomUUID()}`,
        createdAt: at,
        confirmedAt: at,
      },
    });
    await prisma.entry.create({
      data: {
        reference: formatEntryReference(session.number, i),
        sessionId: session.id,
        userId: user.id,
        paymentId: payment.id,
        sequence: i,
        createdAt: at,
      },
    });
  }
  await prisma.drawSession.update({ where: { id: session.id }, data: { confirmedEntries: count } });
}

async function audit(data: Prisma.AuditLogUncheckedCreateInput) {
  await prisma.auditLog.create({ data: { ...data, metadata: { ...(data.metadata as object), seeded: true } } });
}

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0 && !reset) {
    console.log('The database already has data. Run `pnpm db:reset` to wipe it and seed again.');
    return;
  }
  if (reset) {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "DrawWinner", "Draw", "Entry", "Payment", "DrawSession", "AuditLog", "VerificationReview", "IdentityDocument", "AuthSession", "User" RESTART IDENTITY CASCADE',
    );
    console.log('Wiped all tables.');
  }

  const admin = await createUser(ADMIN.email, ADMIN.password, { role: 'ADMIN', verification: 'APPROVED', firstName: 'Admin', lastName: 'Sakan' });
  await createUser(DEMO.email, DEMO.password, { verification: 'APPROVED', firstName: 'Yasmine', lastName: 'Demo', reviewerId: admin.id });
  await createUser(PENDING.email, PENDING.password, { verification: 'PENDING', firstName: 'Hassan', lastName: 'Attente' });
  await createUser('new@sakan.ma', PARTICIPANT_PASSWORD, { verification: 'UNSUBMITTED' });

  const participants = [];
  for (let i = 0; i < 40; i++) {
    participants.push(
      await createUser(`participant${String(i + 1).padStart(2, '0')}@sakan.ma`, PARTICIPANT_PASSWORD, {
        verification: 'APPROVED',
        firstName: FIRST_NAMES[i % FIRST_NAMES.length],
        lastName: LAST_NAMES[(i * 3) % LAST_NAMES.length],
        reviewerId: admin.id,
      }),
    );
  }

  const day = 86_400_000;
  const now = Date.now();
  const base = { currency: 'MAD', createdById: admin.id, timezone: 'Africa/Casablanca', drawTimeOfDay: '18:00' };

  // 1. Completed session with a real, verifiable draw.
  const completed = await prisma.drawSession.create({
    data: {
      ...base,
      name: 'Rabat · Octobre',
      description: 'Session terminée : le tirage a eu lieu et le résultat peut être vérifié.',
      status: 'OPEN',
      entryPriceCents: 5000,
      targetEntries: 25,
      createdAt: new Date(now - 6 * day),
    },
  });
  await addPaidEntries(completed, participants, 25, new Date(now - 5 * day));
  const filledAt = new Date(now - 2 * day - 4 * 3_600_000);
  const scheduledAt = nextDrawTime(filledAt, '18:00', 'Africa/Casablanca');
  const { seed, seedHash } = generateSeed();
  const entries = await prisma.entry.findMany({ where: { sessionId: completed.id }, orderBy: { sequence: 'asc' } });
  const entriesHash = hashEntries(entries.map((e) => e.reference));
  const [winnerIndex] = pickWinnerIndexes(seed, entriesHash, entries.length, 1);
  const draw = await prisma.draw.create({
    data: {
      sessionId: completed.id,
      status: 'COMPLETED',
      scheduledAt,
      seed,
      seedHash,
      entriesHash,
      entryCount: entries.length,
      startedAt: scheduledAt,
      completedAt: new Date(scheduledAt.getTime() + 2_000),
    },
  });
  await prisma.drawWinner.create({ data: { drawId: draw.id, entryId: entries[winnerIndex].id, position: 1 } });
  await prisma.drawSession.update({ where: { id: completed.id }, data: { status: 'COMPLETED', filledAt, drawScheduledAt: scheduledAt } });
  await audit({ action: 'draw.scheduled', entityType: 'DrawSession', entityId: completed.id, metadata: { scheduledAt: scheduledAt.toISOString(), seedHash }, createdAt: filledAt });
  await audit({ action: 'draw.completed', entityType: 'DrawSession', entityId: completed.id, metadata: { entriesHash, entryCount: entries.length, winners: [entries[winnerIndex].reference] }, createdAt: scheduledAt });

  // 2. Scheduled session: full, draw committed (seed hash public), runs at the next 18:00.
  const scheduled = await prisma.drawSession.create({
    data: {
      ...base,
      name: 'Tanger · Riad familial',
      description: 'Objectif atteint : le tirage est programmé et le hachage de la graine est déjà publié.',
      status: 'OPEN',
      entryPriceCents: 10000,
      targetEntries: 30,
      createdAt: new Date(now - 3 * day),
    },
  });
  await addPaidEntries(scheduled, participants, 30, new Date(now - 2 * day));
  const scheduledFilledAt = new Date(now - 3_600_000);
  const scheduledFor = nextDrawTime(new Date(), '18:00', 'Africa/Casablanca');
  const commit = generateSeed();
  await prisma.draw.create({ data: { sessionId: scheduled.id, scheduledAt: scheduledFor, seed: commit.seed, seedHash: commit.seedHash } });
  await prisma.drawSession.update({ where: { id: scheduled.id }, data: { status: 'SCHEDULED', filledAt: scheduledFilledAt, drawScheduledAt: scheduledFor } });
  await audit({ action: 'draw.scheduled', entityType: 'DrawSession', entityId: scheduled.id, metadata: { scheduledAt: scheduledFor.toISOString(), seedHash: commit.seedHash }, createdAt: scheduledFilledAt });

  // 3. The headline example from the spec: 3,000 entries at 100 MAD, draw at 18:00.
  const big = await prisma.drawSession.create({
    data: {
      ...base,
      name: 'Casablanca · Appartement 3 pièces',
      description: 'Objectif de 3 000 participations à 100 MAD. Le tirage a lieu à 18:00 le jour où l’objectif est atteint (ou le lendemain s’il est atteint après 18:00).',
      status: 'OPEN',
      entryPriceCents: 10000,
      targetEntries: 3000,
      maxEntriesPerUser: 10,
      createdAt: new Date(now - day),
    },
  });
  await addPaidEntries(big, participants, 137, new Date(now - day));
  await audit({ actorId: admin.id, action: 'session.opened', entityType: 'DrawSession', entityId: big.id, metadata: {} });

  // 4. Almost full, with a 2-minute draw delay: buy the last entry as demo@sakan.ma to watch the whole flow.
  const quick = await prisma.drawSession.create({
    data: {
      ...base,
      name: 'Session démo rapide',
      description: 'Il manque une seule participation. Achetez-la avec le compte démo : le tirage est programmé et a lieu 2 minutes plus tard.',
      status: 'OPEN',
      entryPriceCents: 2000,
      targetEntries: 10,
      drawDelayMinutes: 2,
      createdAt: new Date(now - 3_600_000),
    },
  });
  await addPaidEntries(quick, participants, 9, new Date(now - 3_000_000));

  // 5. A draft only admins see.
  await prisma.drawSession.create({
    data: {
      ...base,
      name: 'Marrakech · Villa (brouillon)',
      description: 'Brouillon : configurez-le puis ouvrez-le depuis l’administration.',
      entryPriceCents: 20000,
      targetEntries: 5000,
      winnerCount: 1,
    },
  });

  console.log(`
Seeded demo data.

  Admin        ${ADMIN.email} / ${ADMIN.password}
  Demo buyer   ${DEMO.email} / ${DEMO.password}   (approved, no entries yet)
  Pending CIN  ${PENDING.email} / ${PENDING.password}
  No CIN yet   new@sakan.ma / ${PARTICIPANT_PASSWORD}
  40 approved participants: participant01@sakan.ma ... participant40@sakan.ma / ${PARTICIPANT_PASSWORD}

Try it: sign in as the demo buyer, open "Session démo rapide" and buy the last entry.
`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
