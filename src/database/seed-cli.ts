import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import {
  SeedDataError,
  parseSeedDocument,
  placeholderWarning,
  seedCanonicalProfile,
  selectSeedDataFile,
} from './seed-profile.js';

// Seeding is a command. HTTP startup in main.ts does not call this module.
const entryPoint = process.argv[1];
if (
  entryPoint !== undefined &&
  import.meta.url === pathToFileURL(entryPoint).href
) {
  process.exit(await runSeed());
}

export async function runSeed(
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  let prisma: PrismaClient | undefined;

  try {
    const root = join(import.meta.dirname, '../..');
    const dataDirectory = join(root, 'prisma', 'seed-data');
    const selected = selectSeedDataFile({
      configuredPath: configuredSeedPath(root, env.SEED_DATA_PATH),
      localFileExists: existsSync(join(dataDirectory, 'profile.local.json')),
      localPath: join(dataDirectory, 'profile.local.json'),
      examplePath: join(dataDirectory, 'profile.example.json'),
    });
    const document = readSeedDocument(selected.filePath);
    const warning = placeholderWarning({
      origin: selected.origin,
      kind: document.kind,
      filePath: selected.filePath,
    });
    if (warning !== null) {
      console.warn(warning);
    }

    const databaseUrl = env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new SeedDataError('DATABASE_URL is required to seed the database.');
    }

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrl }),
    });
    const result = await seedCanonicalProfile(prisma, document);
    console.log(
      result.replacedExistingProfile
        ? 'Replaced the canonical profile. Related rows were rewritten from the seed file.'
        : 'Created the canonical profile and inserted its related rows from the seed file.',
    );
    console.log(
      `Counts: links=${result.counts.links} skills=${result.counts.skills} experiences=${result.counts.experiences} achievements=${result.counts.achievements} projects=${result.counts.projects}`,
    );
    return 0;
  } catch (error) {
    if (error instanceof SeedDataError) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    return 1;
  } finally {
    await prisma?.$disconnect();
  }
}

function configuredSeedPath(
  root: string,
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return isAbsolute(trimmed) ? trimmed : resolve(root, trimmed);
}

function readSeedDocument(filePath: string) {
  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SeedDataError(`Cannot read seed data at ${filePath}: ${detail}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new SeedDataError(`Seed data at ${filePath} is not valid JSON.`);
  }

  return parseSeedDocument(parsed);
}
