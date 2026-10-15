import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Builds the MySQL driver adapter from the same DATABASE_URL the Prisma CLI uses for migrations,
 * so one URL works for both. Prisma's TLS parameter is mapped onto the driver:
 * - no sslaccept: plain connection, for a local database only;
 * - sslaccept=strict: TLS, and the server certificate must be trusted;
 * - sslaccept=accept_invalid_certs: TLS without checking the certificate (hosts with a private CA).
 * connection_limit sets the pool size (default 10).
 */
export function mysqlAdapter(databaseUrl: string): PrismaMariaDb {
  const url = new URL(databaseUrl);
  if (url.protocol !== 'mysql:') throw new Error('DATABASE_URL must start with mysql://');
  const sslaccept = url.searchParams.get('sslaccept');
  const connectionLimit = Number(url.searchParams.get('connection_limit') ?? 10);
  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit,
    ...(sslaccept
      ? { ssl: { rejectUnauthorized: sslaccept === 'strict' } }
      : // MySQL 8's default sign-in method needs the server's RSA key on a plain connection.
        { allowPublicKeyRetrieval: true }),
  });
}

/**
 * Client options shared by the API and the scripts. Transactions run at READ COMMITTED
 * (MySQL's default is REPEATABLE READ): with lockSession taken first, every read in the
 * transaction sees the latest committed counts, and InnoDB takes fewer gap locks.
 */
export function prismaOptions(databaseUrl: string) {
  return {
    adapter: mysqlAdapter(databaseUrl),
    transactionOptions: { isolationLevel: 'ReadCommitted' as const },
  };
}

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  return new PrismaClient(prismaOptions(databaseUrl));
}
