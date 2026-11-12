import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://business_card:business_card@127.0.0.1:5434/business_card_test?schema=public';

export function resolveTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
  assertSafeTestDatabase(url);
  return url;
}

export function assertSafeTestDatabase(connectionString: string): void {
  let database: string;
  try {
    database = new URL(connectionString).pathname.replace(/^\//, '');
  } catch {
    throw new Error(
      'TEST_DATABASE_URL must be a PostgreSQL connection string.',
    );
  }

  if (!database.endsWith('_test')) {
    throw new Error(
      `Refusing to use database "${database}". Integration tests only run against a database whose name ends with _test.`,
    );
  }
}

export function applyMigrations(connectionString: string): void {
  assertSafeTestDatabase(connectionString);
  execFileSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      env: { ...process.env, DATABASE_URL: connectionString },
      stdio: 'inherit',
    },
  );
}

export function createLoggingPrisma(connectionString: string): {
  prisma: PrismaClient;
  queries: string[];
} {
  assertSafeTestDatabase(connectionString);
  const queries: string[] = [];
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: [{ emit: 'event', level: 'query' }],
  });
  prisma.$on('query', (event) => {
    queries.push(event.query);
  });
  return { prisma, queries };
}

export async function clearCard(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "achievements", "experiences", "professional_links", "skills", "projects", "profile" RESTART IDENTITY CASCADE`,
  );
}
