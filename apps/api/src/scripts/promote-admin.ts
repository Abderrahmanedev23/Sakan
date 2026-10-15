// Gives an existing account the ADMIN role. There is deliberately no API for this.
// Usage: pnpm --filter @sakan/api admin:promote you@example.com
import 'dotenv/config';
import { createPrismaClient } from '../prisma/database.js';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: admin:promote <email>');
  process.exit(1);
}

const prisma = createPrismaClient();
try {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No account with email ${email}. Sign up first.`);
    process.exitCode = 1;
  } else if (user.role === 'ADMIN') {
    console.log(`${email} is already an admin.`);
  } else {
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } }),
      prisma.auditLog.create({
        data: { action: 'user.promoted_admin', entityType: 'User', entityId: user.id, metadata: { via: 'cli' } },
      }),
    ]);
    console.log(`${email} is now an admin.`);
  }
} finally {
  await prisma.$disconnect();
}
